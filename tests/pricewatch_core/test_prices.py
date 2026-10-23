import copy
from decimal import Decimal, localcontext
import random
import json
from pathlib import Path
import socket
import subprocess
import sys
import unittest
from unittest.mock import patch

from pricewatch_price import compare_prices, extract_price
from pricewatch_price.core import MAX_HTML_BYTES, MAX_JSON_BYTES

PAGE = "https://shop.example.test/products/mug"
FIXTURES = Path(__file__).parent / "fixtures"


def product(price="29.90", **offer_fields):
    return {"@context": "https://schema.org", "@type": "Product", "@id": "#mug", "sku": "MUG-BLUE-12",
            "name": "Synthetic fixture mug", "color": "blue", "size": "12 oz",
            "offers": {"@type": "Offer", "price": price, "priceCurrency": "USD", "availability": "https://schema.org/InStock", **offer_fields}}


def html(value, before="", after=""):
    return '<!doctype html><html><head>' + before + '<script type="application/ld+json">' + json.dumps(value) + '</script>' + after + '</head><body>Fixture only</body></html>'


def extract(value, **kwargs):
    return extract_price(html(value), page_url=PAGE, **kwargs)


def snapshot(value):
    result = extract(value)
    if result["status"] != "ok":
        raise AssertionError(result)
    return result["snapshot"]


class ExtractionTests(unittest.TestCase):
    def test_fixture_baseline(self):
        result = extract_price((FIXTURES / "baseline.html").read_text(), page_url=PAGE)
        self.assertEqual(result["status"], "ok")
        snap = result["snapshot"]
        self.assertEqual(snap["price"], {"amount": "29.9", "coefficient": "299", "scale": 1, "currency": "USD"})
        self.assertEqual(snap["availability"], "InStock")
        self.assertEqual(snap["evidence"]["price_path"], "$.offers.price")
        self.assertEqual(snap["evidence"]["raw_price"], "29.90")
        self.assertEqual(snap["evidence"]["raw_price_type"], "string")
        json.dumps(result)  # Persistable without floats or Decimal serialization hacks.

    def test_graph_and_offer_reference(self):
        result = extract_price((FIXTURES / "graph.html").read_text(), page_url=PAGE)
        self.assertEqual(result["status"], "ok", result)
        self.assertEqual(result["snapshot"]["evidence"]["offer_path"], "$.@graph[1]")
        self.assertEqual(result["snapshot"]["offer"]["@id"], PAGE + "#offer")

    def test_numeric_decimal_lexeme_is_exact(self):
        raw = html(product("TOKEN")).replace('"TOKEN"', "9007199254740993.123456789012")
        snap = extract_price(raw, page_url=PAGE)["snapshot"]
        self.assertEqual(snap["price"]["amount"], "9007199254740993.123456789012")
        self.assertEqual(snap["price"]["coefficient"], "9007199254740993123456789012")
        self.assertEqual(snap["evidence"]["raw_price_type"], "number")

    def test_free_price_zero(self):
        for price in ("0", "0.00", 0):
            with self.subTest(price=price):
                self.assertEqual(snapshot(product(price))["price"]["amount"], "0")

    def test_supported_currencies_preserve_decimal_units(self):
        for currency, price in (("EUR", "12.34"), ("JPY", "1234"), ("KWD", "0.001"), ("BHD", "1.234")):
            with self.subTest(currency=currency):
                snap = snapshot(product(price, priceCurrency=currency))
                self.assertEqual(snap["price"]["currency"], currency)
                self.assertEqual(snap["price"]["amount"], price)

    def test_invalid_or_unsupported_currencies(self):
        for currency in (None, "", "$", "usd", "ZZZ", " USD ", ["USD", "EUR"], 840):
            with self.subTest(currency=currency):
                self.assertEqual(extract(product(priceCurrency=currency))["reason"], "unsupported_or_missing_currency")

    def test_invalid_prices(self):
        for price in (None, True, False, -1, "-1", "-0", "+1", " 1", "1 ", "01", "1,000.00", "1.234,56", "$12", "free", "NaN", "Infinity", "1e3", "1.", ".5", "1.1234567890123", "1" * 31, [], {}, "12–15"):
            with self.subTest(price=price):
                self.assertEqual(extract(product(price))["status"], "unsupported")

    def test_numeric_exponent_is_not_silently_normalized(self):
        for token in ("1e2", "-0", "NaN", "Infinity", "-Infinity"):
            with self.subTest(token=token):
                self.assertEqual(extract_price(html(product("TOKEN")).replace('"TOKEN"', token), page_url=PAGE)["status"], "unsupported")

    def test_multiple_products_even_when_ids_are_different(self):
        other = product("1")
        other["@id"], other["sku"] = "#other", "OTHER"
        self.assertEqual(extract([product(), other])["reason"], "multiple_products")

    def test_multiple_identical_product_definitions_are_ambiguous(self):
        self.assertEqual(extract([product(), product()])["reason"], "duplicate_node_id")

    def test_multiple_offers_even_same_price_are_ambiguous(self):
        obj = product()
        obj["offers"] = [obj["offers"], copy.deepcopy(obj["offers"])]
        self.assertEqual(extract(obj)["reason"], "multiple_offers")

    def test_single_element_offer_array(self):
        obj = product()
        obj["offers"] = [obj["offers"]]
        self.assertEqual(snapshot(obj)["evidence"]["offer_path"], "$.offers[0]")

    def test_detached_second_offer_is_ambiguous(self):
        obj = {"@context": "https://schema.org", "@graph": [product(), {"@type": "Offer", "price": "1"}]}
        self.assertEqual(extract(obj)["reason"], "additional_offers_present")

    def test_aggregate_and_price_ranges(self):
        for fields in ({"@type": "AggregateOffer"}, {"lowPrice": "10"}, {"highPrice": "20"}, {"offerCount": 2}):
            with self.subTest(fields=fields):
                self.assertEqual(extract(product(**fields))["reason"], "aggregate_price_unsupported")

    def test_availability_must_be_explicit_and_known(self):
        for availability in (None, "", "unknown", ["InStock", "OutOfStock"], True):
            with self.subTest(availability=availability):
                self.assertEqual(extract(product(availability=availability))["reason"], "unsupported_or_missing_availability")
        for availability in ("OutOfStock", "SoldOut", "PreOrder", "PreSale", "BackOrder", "Discontinued", "LimitedAvailability", "OnlineOnly", "InStoreOnly"):
            with self.subTest(availability=availability):
                self.assertEqual(snapshot(product(availability=availability))["availability"], availability)

    def test_concrete_variant_reference_and_sku(self):
        obj = product()
        obj["isVariantOf"] = {"@id": "/groups/mugs"}
        snap = snapshot(obj)
        self.assertEqual(snap["product"]["variant"]["isVariantOf"], "https://shop.example.test/groups/mugs")
        del obj["sku"]
        self.assertEqual(extract(obj)["reason"], "variant_sku_required")

    def test_variant_groups_require_selection(self):
        obj = product()
        obj["hasVariant"] = []
        self.assertEqual(extract(obj)["reason"], "variant_selection_required")
        obj = {"@context": "https://schema.org", "@type": "ProductGroup", "hasVariant": [product()]}
        self.assertEqual(extract(obj)["reason"], "product_groups_unsupported")

    def test_non_scalar_variant_is_unsupported(self):
        obj = product()
        obj["size"] = ["S", "M"]
        self.assertEqual(extract(obj)["reason"], "ambiguous_variant")

    def test_custom_variant_properties_are_unsupported(self):
        obj = product()
        obj["additionalProperty"] = {"@type": "PropertyValue", "name": "Width", "value": "wide"}
        self.assertEqual(extract(obj)["reason"], "custom_variant_or_product_relationship_unsupported")

    def test_identity_required_and_names_not_used(self):
        obj = product()
        del obj["sku"], obj["@id"]
        self.assertEqual(extract(obj)["reason"], "stable_product_identity_required")
        obj["url"] = "/p/mug?variant=blue"
        self.assertEqual(snapshot(obj)["product"]["identifiers"]["url"], "https://shop.example.test/p/mug?variant=blue")

    def test_condition_agreement(self):
        obj = product(itemCondition="NewCondition")
        obj["itemCondition"] = "https://schema.org/UsedCondition"
        self.assertEqual(extract(obj)["reason"], "conflicting_item_condition")

    def test_conditional_prices_not_guessed(self):
        for field in ("priceSpecification", "priceValidUntil", "eligibleQuantity", "eligibleCustomerType", "businessFunction", "validFrom"):
            with self.subTest(field=field):
                self.assertEqual(extract(product(**{field: "conditional"}))["reason"], "conditional_price_unsupported")

    def test_offer_product_match(self):
        self.assertEqual(extract(product(sku="OTHER"))["reason"], "offer_product_identity_mismatch")
        self.assertEqual(extract(product(itemOffered={"@id": "#wrong"}))["reason"], "item_offered_mismatch")
        self.assertEqual(extract(product(itemOffered={"@id": "#mug"}))["status"], "ok")

    def test_unsupported_contexts(self):
        for context in ({"@vocab": "https://schema.org/"}, ["https://schema.org"], "https://evil.example/", None):
            with self.subTest(context=context):
                obj = product()
                obj["@context"] = context
                self.assertEqual(extract(obj)["reason"], "custom_or_missing_context")
        obj = product()
        del obj["@context"]
        self.assertEqual(extract(obj)["reason"], "custom_or_missing_context")

    def test_full_schema_type_urls(self):
        obj = product()
        obj["@type"] = "https://schema.org/Product"
        obj["offers"]["@type"] = "http://schema.org/Offer"
        self.assertEqual(extract(obj)["status"], "ok")

    def test_nested_context_cannot_redefine_price(self):
        obj = product(**{"@context": {"price": "https://evil.example/amount"}})
        self.assertEqual(extract(obj)["reason"], "custom_or_missing_context")

    def test_duplicate_keys_not_last_wins(self):
        raw = html(product()).replace('"price": "29.90"', '"price": "29.90", "price": "1.00"')
        self.assertEqual(extract_price(raw, page_url=PAGE)["reason"], "duplicate_json_key")
        raw = html(product()).replace('"price": "29.90"', '"price": "29.90", "pr\\u0069ce": "1.00"')
        self.assertEqual(extract_price(raw, page_url=PAGE)["reason"], "duplicate_json_key")

    def test_malformed_ld_block_cannot_be_ignored(self):
        raw = html(product(), before='<script type="application/ld+json">{"@type":</script>')
        self.assertEqual(extract_price(raw, page_url=PAGE)["reason"], "malformed_jsonld")

    def test_unresolved_and_duplicate_references(self):
        obj = product()
        obj["offers"] = {"@id": "#missing"}
        self.assertEqual(extract(obj)["reason"], "unresolved_offer_reference")

    def test_url_contract(self):
        for url in (None, "file:///secret", "javascript:alert(1)", "https://u:p@example.test/p", "https://host.test:bad/p", "https://host.test\\evil/p", "https://host.test/a b"):
            with self.subTest(url=url):
                self.assertEqual(extract_price(html(product()), page_url=url)["status"], "unsupported")

    def test_rejects_graph_language_maps_and_other_advanced_jsonld(self):
        obj = product()
        obj["name"] = {"@value": "Mug", "@language": "en"}
        self.assertEqual(extract(obj)["reason"], "advanced_jsonld_unsupported")

    def test_no_network_calls(self):
        with patch.object(socket.socket, "connect", side_effect=AssertionError("network forbidden")):
            self.assertEqual(extract(product())["status"], "ok")


class HtmlTests(unittest.TestCase):
    def test_comments_and_non_ld_scripts_do_not_supply_products(self):
        fake = html(product("1"))
        raw = '<!--' + fake + '--><script>var pretend = "price 1.00";</script>'
        self.assertEqual(extract_price(raw, page_url=PAGE)["reason"], "no_jsonld")

    def test_inert_and_raw_text_contexts_ignored(self):
        for tag in ("template", "textarea", "title", "xmp", "iframe", "noscript", "svg", "math", "style", "plaintext"):
            with self.subTest(tag=tag):
                raw = f'<{tag}>' + html(product()) + f'</{tag}>'
                self.assertNotEqual(extract_price(raw, page_url=PAGE)["status"], "ok")

    def test_self_closing_script_inside_template_does_not_expose_later_markup(self):
        raw = '<template><script/></template>' + html(product())
        self.assertNotEqual(extract_price(raw, page_url=PAGE)["status"], "ok")

    def test_valid_script_after_inert_content(self):
        raw = '<template>' + html(product("1")) + '</template>' + html(product("20"))
        self.assertEqual(extract_price(raw, page_url=PAGE)["snapshot"]["price"]["amount"], "20")

    def test_script_tag_case_unquoted_type_and_angle_attribute(self):
        raw = html(product()).replace('<script type="application/ld+json">', '<SCRIPT data-note="a > b" TYPE=application/ld+json>')
        raw = raw.replace('</script>', '</SCRIPT>')
        self.assertEqual(extract_price(raw, page_url=PAGE)["status"], "ok")

    def test_script_attribute_html_entities_are_decoded_but_json_is_not(self):
        raw = html(product()).replace('application/ld+json', 'application/ld&#43;json')
        self.assertEqual(extract_price(raw, page_url=PAGE)["status"], "ok")
        raw = html(product()).replace('"29.90"', '&quot;29.90&quot;')
        self.assertEqual(extract_price(raw, page_url=PAGE)["reason"], "malformed_jsonld")

    def test_duplicate_script_attributes_rejected(self):
        raw = html(product()).replace('<script ', '<script type="text/plain" ')
        self.assertEqual(extract_price(raw, page_url=PAGE)["reason"], "duplicate_script_attribute")

    def test_external_scripts_are_never_fetched(self):
        raw = '<script type="application/ld+json" src="https://example.test/product.json"></script>'
        self.assertEqual(extract_price(raw, page_url=PAGE)["reason"], "external_jsonld_unsupported")

    def test_unterminated_and_self_closing_scripts(self):
        raw = html(product()).split('</script>')[0]
        self.assertEqual(extract_price(raw, page_url=PAGE)["reason"], "unterminated_jsonld_script")
        raw = html(product()).replace('<script type="application/ld+json">', '<script type="application/ld+json"/>')
        self.assertEqual(extract_price(raw, page_url=PAGE)["reason"], "self_closing_script_unsupported")

    def test_embedded_closing_script_does_not_leak_markup(self):
        obj = product()
        obj["description"] = '</script><script type="application/ld+json">{}'
        self.assertEqual(extract(obj)["reason"], "malformed_jsonld")

    def test_bare_visible_prices_and_microdata_not_supported(self):
        self.assertEqual(extract_price('<span itemprop="price">$29.90</span>', page_url=PAGE)["reason"], "no_jsonld")

    def test_limits(self):
        self.assertEqual(extract_price("x" * (MAX_HTML_BYTES + 1), page_url=PAGE)["reason"], "resource_limit")
        obj = product()
        obj["description"] = "x" * MAX_JSON_BYTES
        self.assertEqual(extract(obj)["reason"], "resource_limit")
        self.assertEqual(extract_price('<script type="application/ld+json">' * 0 + html(product()) * 33, page_url=PAGE)["reason"], "resource_limit")
        raw = '<script type="application/ld+json">' + '[' * 33 + '0' + ']' * 33 + '</script>'
        self.assertEqual(extract_price(raw, page_url=PAGE)["reason"], "resource_limit")
        obj = product()
        obj["padding"] = [0] * 5001
        self.assertEqual(extract(obj)["reason"], "resource_limit")


class ComparisonTests(unittest.TestCase):
    def test_promotion_changes_are_unchanged(self):
        before = extract_price((FIXTURES / "baseline.html").read_text(), page_url=PAGE)["snapshot"]
        after = extract_price((FIXTURES / "promotion-only.html").read_text(), page_url=PAGE)["snapshot"]
        self.assertEqual(compare_prices(before, after)["status"], "unchanged")

    def test_decrease_increase_and_free(self):
        for a, b, expected in (("10", "9.99", "price_decreased"), ("9.99", "10", "price_increased"), ("1", "0", "price_decreased"), ("0", "1", "price_increased"), ("1.000", "1", "unchanged")):
            with self.subTest(a=a, b=b):
                self.assertEqual(compare_prices(snapshot(product(a)), snapshot(product(b)))["status"], expected)

    def test_large_numbers_and_tiny_difference(self):
        a = snapshot(product("999999999999999999999999999999.123456789012"))
        b = snapshot(product("999999999999999999999999999999.123456789011"))
        self.assertEqual(compare_prices(a, b)["status"], "price_decreased")

    def test_seeded_exact_decimal_comparisons(self):
        rng = random.Random(6989053)
        def decimal_string():
            integer = str(rng.randrange(10 ** 30))
            scale = rng.randrange(13)
            return integer + ("." + str(rng.randrange(10 ** scale)).zfill(scale) if scale else "")
        with localcontext() as context:
            context.prec = 100
            for _ in range(1000):
                a, b = decimal_string(), decimal_string()
                expected = "price_decreased" if Decimal(b) < Decimal(a) else "price_increased" if Decimal(b) > Decimal(a) else "unchanged"
                self.assertEqual(compare_prices(snapshot(product(a)), snapshot(product(b)))["status"], expected)

    def test_same_variant_identity_required(self):
        for key, value in (("sku", "OTHER"), ("@id", "#other"), ("color", "red"), ("size", "16 oz")):
            with self.subTest(key=key):
                obj = product("1")
                obj[key] = value
                self.assertEqual(compare_prices(snapshot(product()), snapshot(obj))["reason"], "product_changed")

    def test_disappearing_variant_field_is_incomparable(self):
        obj = product("1")
        del obj["size"]
        self.assertEqual(compare_prices(snapshot(product()), snapshot(obj))["reason"], "product_changed")

    def test_source_scope_currency_seller_and_condition_guards(self):
        base = snapshot(product())
        current = copy.deepcopy(base)
        current["page_url"] += "?currency=EUR"
        self.assertEqual(compare_prices(base, current)["reason"], "page_url_changed")
        self.assertEqual(compare_prices(base, snapshot(product("1", priceCurrency="EUR")))["reason"], "currency_changed")
        self.assertEqual(compare_prices(base, snapshot(product("1", seller={"url": "https://seller.example.test/"})))["reason"], "offer_changed")
        self.assertEqual(compare_prices(base, snapshot(product("1", itemCondition="UsedCondition")))["reason"], "offer_changed")

    def test_availability_transitions_suppress_price_event(self):
        for before, after in (("InStock", "OutOfStock"), ("OutOfStock", "InStock"), ("PreOrder", "PreOrder"), ("OutOfStock", "OutOfStock")):
            with self.subTest(before=before, after=after):
                result = compare_prices(snapshot(product("20", availability=before)), snapshot(product("1", availability=after)))
                self.assertEqual(result["status"], "not_comparable_price")
                self.assertEqual(result["availability_changed"], before != after)

    def test_roundtrip_and_no_mutation(self):
        a = snapshot(product())
        b = snapshot(product("1"))
        original = copy.deepcopy((a, b))
        self.assertEqual(compare_prices(json.loads(json.dumps(a)), json.loads(json.dumps(b)))["status"], "price_decreased")
        self.assertEqual((a, b), original)

    def test_tampered_snapshot_never_compared(self):
        base = snapshot(product())
        mutations = [("coefficient", "1"), ("scale", 10000000), ("scale", True), ("amount", "NaN"), ("amount", "-1"), ("currency", "ZZZ")]
        for key, value in mutations:
            with self.subTest(key=key, value=value):
                bad = copy.deepcopy(base)
                bad["price"][key] = value
                self.assertEqual(compare_prices(base, bad)["reason"], "invalid_snapshot")
        for bad in (None, {}, {"schema": "pricewatch.price.v0"}, {"schema": "pricewatch.price.v1"}):
            self.assertEqual(compare_prices(base, bad)["reason"], "invalid_snapshot")

    def test_invalid_extraction_is_not_a_snapshot(self):
        self.assertEqual(compare_prices(snapshot(product()), extract(product(priceCurrency=None)))["reason"], "invalid_snapshot")


class CliTests(unittest.TestCase):
    def test_cli_extracts_from_stdin(self):
        request = {"html": html(product()), "page_url": PAGE}
        result = subprocess.run([sys.executable, "-m", "pricewatch_price"], input=json.dumps(request), text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "ok")

    def test_cli_rejects_invalid_request(self):
        for request in ('{', '[]', '{}', '{"operation":"fetch"}'):
            result = subprocess.run([sys.executable, "-m", "pricewatch_price"], input=request, text=True, capture_output=True)
            self.assertEqual(result.returncode, 2)
            self.assertNotIn("Traceback", result.stderr)

    def test_cli_compare(self):
        request = {"operation": "compare", "previous": snapshot(product()), "current": snapshot(product("1"))}
        result = subprocess.run([sys.executable, "-m", "pricewatch_price"], input=json.dumps(request), text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "price_decreased")

if __name__ == "__main__":
    unittest.main()
