"""Independent offline regressions for identity and conservative parsing.

No production sources, live websites, or third-party dependencies are used.
Rejecting an unsupported construct is an acceptable outcome; it must not turn
into a verified ordinary price observation or hide a second live product.
"""
import copy
import json
import subprocess
import sys
import unittest

from pricewatch_price import compare_prices, extract_price


PAGE = "https://shop.example.test/item"


def product(price="10", sku="SKU-A"):
    return {
        "@context": "https://schema.org",
        "@type": "Product",
        "sku": sku,
        "offers": {
            "@type": "Offer",
            "price": price,
            "priceCurrency": "USD",
            "availability": "InStock",
        },
    }


def script(node):
    return '<script type="application/ld+json">' + json.dumps(node) + "</script>"


class IndependentHtmlReview(unittest.TestCase):
    def assert_rejected(self, html):
        result = extract_price(html, page_url=PAGE)
        self.assertIn(result["status"], ("unsupported", "ambiguous"), result)

    def test_base_cannot_silently_change_relative_identity(self):
        before = product()
        before.pop("sku")
        before["@id"] = "product"
        after = copy.deepcopy(before)
        after["offers"]["price"] = "9"
        a = extract_price('<base href="https://shop.example.test/first/">' + script(before), page_url=PAGE)
        b = extract_price('<base href="https://shop.example.test/second/">' + script(after), page_url=PAGE)
        if a["status"] == b["status"] == "ok":
            self.assertEqual(compare_prices(a["snapshot"], b["snapshot"])["status"], "incomparable")

    def test_svg_breakout_does_not_hide_second_live_product(self):
        self.assert_rejected("<svg><p>" + script(product()) + "</p></svg>" + script(product(sku="SKU-B")))

    def test_svg_html_integration_point_does_not_hide_product(self):
        self.assert_rejected("<svg><foreignObject>" + script(product()) + "</foreignObject></svg>" + script(product(sku="SKU-B")))

    def test_mathml_html_integration_point_does_not_hide_product(self):
        for opening, closing in (
            ("<math><mi>", "</mi></math>"),
            ('<math><annotation-xml encoding="text/html">', "</annotation-xml></math>"),
        ):
            with self.subTest(opening=opening):
                self.assert_rejected(opening + script(product()) + closing + script(product(sku="SKU-B")))

    def test_abrupt_empty_comment_does_not_hide_product(self):
        for opener in ("<!-->", "<!--->"):
            with self.subTest(opener=opener):
                self.assert_rejected(opener + script(product()) + "<!-- -->" + script(product(sku="SKU-B")))

    def test_normal_comment_remains_non_product_content(self):
        result = extract_price("<!--" + script(product(sku="COMMENT-ONLY")) + "-->" + script(product()), page_url=PAGE)
        self.assertEqual(result["status"], "ok", result)
        self.assertEqual(result["snapshot"]["product"]["identifiers"]["sku"], "SKU-A")


class IndependentMetadataReview(unittest.TestCase):
    def test_changed_unsupported_model_cannot_create_price_event(self):
        before = product()
        before.pop("sku")
        before.update({"@id": "#phone", "model": "Phone 64 GB"})
        after = copy.deepcopy(before)
        after["model"] = "Phone 128 GB"
        after["offers"]["price"] = "9"
        a, b = (extract_price(script(p), page_url=PAGE) for p in (before, after))
        if a["status"] == b["status"] == "ok":
            self.assertEqual(compare_prices(a["snapshot"], b["snapshot"])["status"], "incomparable")

    def test_unknown_product_metadata_is_not_silently_ignored(self):
        node = product()
        node["merchantSelectedVariant"] = "unverified option"
        result = extract_price(script(node), page_url=PAGE)
        self.assertNotEqual(result["status"], "ok", result)

    def test_unsupported_offer_qualifiers_are_not_unconditional_price(self):
        for field, value in (
            ("validForMemberTier", "https://shop.example.test/gold"),
            ("priceComponentType", "Downpayment"),
            ("unitCode", "KGM"),
            ("valueAddedTaxIncluded", False),
            ("merchantConditionalPrice", "members only"),
        ):
            with self.subTest(field=field):
                node = product()
                node["offers"][field] = value
                result = extract_price(script(node), page_url=PAGE)
                self.assertNotEqual(result["status"], "ok", result)

    def test_supported_non_price_copy_remains_unchanged(self):
        before = product()
        before["description"] = "Ordinary product description"
        after = copy.deepcopy(before)
        after["description"] = "A new promotional description"
        a, b = (extract_price(script(p), page_url=PAGE) for p in (before, after))
        self.assertEqual(a["status"], "ok", a)
        self.assertEqual(b["status"], "ok", b)
        self.assertEqual(compare_prices(a["snapshot"], b["snapshot"])["status"], "unchanged")


class IndependentCliReview(unittest.TestCase):
    def assert_cli_rejected(self, request):
        result = subprocess.run([sys.executable, "-m", "pricewatch_price"], input=request, text=True, capture_output=True)
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "unsupported")
        self.assertNotIn("Traceback", result.stderr)

    def test_duplicate_request_html_is_not_last_wins(self):
        request = '{"page_url":' + json.dumps(PAGE) + ',"html":"not a product","html":' + json.dumps(script(product())) + "}"
        self.assert_cli_rejected(request)

    def test_duplicate_snapshot_amount_is_rejected(self):
        snapshot = extract_price(script(product()), page_url=PAGE)["snapshot"]
        encoded = json.dumps(snapshot).replace('"amount": "10"', '"amount":"999", "amount":"10"')
        self.assert_cli_rejected('{"operation":"compare","previous":' + encoded + ',"current":' + encoded + "}")

    def test_unicode_escape_duplicate_request_key_is_rejected(self):
        request = '{"page_url":' + json.dumps(PAGE) + ',"html":"not a product","h\\u0074ml":' + json.dumps(script(product())) + "}"
        self.assert_cli_rejected(request)


if __name__ == "__main__":
    unittest.main()
