"""Local-only review regressions; no fetching or third-party dependencies.

These cases describe the narrow fail-closed contract. No rejection reason is
specified so the implementation can reject at the earliest safe boundary.
"""
import copy
import json
import unittest

from pricewatch_price.core import compare_prices, extract_price


PAGE_URL = "https://example.test/item"


def product():
    return {
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": "#product",
        "sku": "sku-1",
        "offers": {
            "@type": "Offer",
            "price": "10.00",
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock",
        },
    }


def script(node):
    return '<script type="application/ld+json">' + json.dumps(node) + "</script>"


def extract(node):
    return extract_price(script(node), page_url=PAGE_URL)


class AdversarialExtractionReview(unittest.TestCase):
    def assert_rejected(self, html):
        result = extract_price(html, page_url=PAGE_URL)
        self.assertNotEqual(result["status"], "ok", result)

    def test_control_simple_product(self):
        result = extract(product())
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["snapshot"]["price"]["amount"], "10")

    def test_selfclosing_inert_and_raw_starts(self):
        # A slash does not close an HTML non-void element. In particular style
        # is also raw text, though HTMLParser handles its ordinary start itself.
        for tag in ("template", "textarea", "title", "xmp", "iframe",
                    "noembed", "noframes", "noscript", "plaintext", "style"):
            with self.subTest(tag=tag):
                self.assert_rejected("<" + tag + "/>" + script(product()))

    def test_selfclosing_nested_template_does_not_end_outer_template(self):
        self.assert_rejected("<template><template/></template>" + script(product()))

    def test_frameset_does_not_create_script_element(self):
        # The HTML 'in frameset' insertion mode ignores an ordinary script tag.
        self.assert_rejected("<!doctype html><html><head></head><frameset>"
                             + script(product()) + "</frameset></html>")

    def test_double_escaped_script_text_does_not_create_jsonld_element(self):
        # HTMLParser does not implement the HTML script double-escaped state.
        # Its first apparent closing script is text in the browser tokenizer.
        self.assert_rejected("<script><!--<script></script>" + script(product()))

    def test_duplicate_type_attribute_does_not_hide_second_product(self):
        other = product()
        other["sku"] = "different-sku"
        other["@id"] = "#other-product"
        # Browsers retain the first attribute, dict(attrs) retains the last.
        hidden = ('<script type="application/ld+json" type="text/javascript">'
                  + json.dumps(other) + "</script>")
        self.assert_rejected(script(product()) + hidden)

    def test_additional_offer_same_jsonld_document(self):
        node = product()
        other = copy.deepcopy(node["offers"])
        other["price"] = "99"
        node["@graph"] = [other]
        self.assert_rejected(script(node))

    def test_additional_offer_separate_jsonld_document(self):
        other = copy.deepcopy(product()["offers"])
        other["@context"] = "https://schema.org"
        other["price"] = "99"
        self.assert_rejected(script(product()) + script(other))

    def test_additional_aggregate_offer(self):
        other = {"@context": "https://schema.org", "@type": "AggregateOffer",
                 "lowPrice": "1", "highPrice": "99", "priceCurrency": "USD"}
        self.assert_rejected(script(product()) + script(other))

    def test_full_iri_conditional_property_is_not_ignored(self):
        node = product()
        node["offers"]["https://schema.org/eligibleCustomerType"] = "Business"
        self.assert_rejected(script(node))

    def test_full_iri_conflicting_availability_is_not_ignored(self):
        node = product()
        node["offers"]["https://schema.org/availability"] = "OutOfStock"
        self.assert_rejected(script(node))

    def test_full_iri_additional_offers_property_is_not_ignored(self):
        node = product()
        node["https://schema.org/offers"] = {"@id": "#unresolved-other-offer"}
        self.assert_rejected(script(node))

    def test_full_iri_variant_property_is_not_ignored(self):
        node = product()
        node["https://schema.org/size"] = ["S", "L"]
        self.assert_rejected(script(node))

    def test_offer_reference_does_not_cross_named_graph_boundary(self):
        node = product()
        offer = node["offers"]
        offer["@id"] = "#offer"
        node["offers"] = {"@id": "#offer"}
        root = {"@context": "https://schema.org", "@graph": [
            node, {"@id": "#different-graph", "@graph": [offer]},
        ]}
        self.assert_rejected(script(root))

    def test_root_graph_bearing_node_is_not_anonymous_graph_wrapper(self):
        node = product()
        node.pop("@id")
        offer = node["offers"]
        offer["@id"] = "#offer"
        node["offers"] = {"@id": "#offer"}
        node["@graph"] = [offer]
        self.assert_rejected(script(node))

    def test_seller_reference_definition_change_is_not_price_event(self):
        node = product()
        node["offers"]["seller"] = {"@id": "#seller"}
        previous = {"@context": "https://schema.org", "@graph": [
            node, {"@type": "Organization", "@id": "#seller",
                   "url": "https://seller-a.test/"},
        ]}
        current = copy.deepcopy(previous)
        current["@graph"][0]["offers"]["price"] = "9"
        current["@graph"][1]["url"] = "https://seller-b.test/"
        before, after = extract(previous), extract(current)
        if before["status"] == after["status"] == "ok":
            result = compare_prices(before["snapshot"], after["snapshot"])
            self.assertEqual(result["status"], "incomparable", result)


class AdversarialSnapshotReview(unittest.TestCase):
    def setUp(self):
        self.previous = extract(product())["snapshot"]
        node = product()
        node["offers"]["price"] = "9"
        self.current = extract(node)["snapshot"]

    def test_control_real_decrease(self):
        result = compare_prices(self.previous, self.current)
        self.assertEqual(result["status"], "price_decreased")

    def test_modified_coefficient_is_rejected(self):
        self.current["price"]["coefficient"] = "1"
        self.assertEqual(compare_prices(self.previous, self.current)["status"], "incomparable")

    def test_contradictory_evidence_price_is_rejected(self):
        self.current["evidence"]["raw_price"] = "10.00"
        self.assertEqual(compare_prices(self.previous, self.current)["status"], "incomparable")

    def test_contradictory_evidence_availability_is_rejected(self):
        self.current["evidence"]["raw_availability"] = "OutOfStock"
        self.assertEqual(compare_prices(self.previous, self.current)["status"], "incomparable")

    def test_missing_evidence_is_rejected(self):
        self.current.pop("evidence")
        self.assertEqual(compare_prices(self.previous, self.current)["status"], "incomparable")


if __name__ == "__main__":
    unittest.main()
