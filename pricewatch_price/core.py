"""A deliberately narrow contract, not a general JSON-LD processor or scraper.

No network, browser, filesystem writes, or merchant-specific extraction. All input
is caller-supplied HTML. Unclear identity, price, offer or availability is rejected.
"""
from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit

SCHEMA = "pricewatch.price.v1"
MAX_HTML_BYTES = 2 * 1024 * 1024
MAX_JSON_BYTES = 256 * 1024
MAX_BLOCKS = 32
MAX_DEPTH = 32
MAX_NODES = 5000
# Explicit supported codes; this is intentionally not a live ISO 4217 registry.
CURRENCIES = frozenset("USD EUR GBP CAD AUD NZD JPY CHF CNY HKD SGD INR KRW KWD BHD OMR TND CLP".split())
AVAILABILITIES = frozenset("InStock OutOfStock SoldOut PreOrder PreSale BackOrder Discontinued LimitedAvailability OnlineOnly InStoreOnly".split())
CONDITIONS = frozenset("NewCondition UsedCondition RefurbishedCondition DamagedCondition".split())
CONTEXTS = frozenset(("https://schema.org", "https://schema.org/", "http://schema.org", "http://schema.org/"))
ID_FIELDS = ("sku", "productID", "gtin", "gtin8", "gtin12", "gtin13", "gtin14", "mpn")
VARIANT_FIELDS = ("color", "size", "material", "pattern", "inProductGroupWithID")
PRODUCT_FIELDS = frozenset(ID_FIELDS + VARIANT_FIELDS + (
    "@context", "@type", "@id", "url", "offers", "isVariantOf", "itemCondition",
    "name", "description", "image", "aggregateRating", "review", "keywords"))
OFFER_FIELDS = frozenset(ID_FIELDS + (
    "@context", "@type", "@id", "url", "price", "priceCurrency", "availability",
    "itemOffered", "itemCondition", "seller", "name", "description", "image"))
# Any of these changes the meaning of a simple, unconditional item price.
CONDITIONAL_FIELDS = frozenset("priceSpecification priceValidUntil validFrom validThrough availabilityStarts availabilityEnds eligibleQuantity eligibleCustomerType eligibleRegion ineligibleRegion eligibleDuration eligibleTransactionVolume includesObject addOn businessFunction leaseLength priceType".split())
DECIMAL = re.compile(r"(?:0|[1-9][0-9]{0,29})(?:\.[0-9]{1,12})?\Z", re.ASCII)


class Rejected(Exception):
    def __init__(self, reason: str, status: str = "unsupported"):
        self.reason, self.status = reason, status


class JsonNumber(str):
    """Original JSON number lexeme, never rounded through binary float."""


def fail(reason: str, status: str = "unsupported"):
    raise Rejected(reason, status)


def plain(value):
    return isinstance(value, str) and not isinstance(value, JsonNumber)


def text_value(value, reason):
    if not plain(value) or not value or value != value.strip() or len(value) > 512:
        fail(reason)
    if any(ord(c) < 32 or 0xD800 <= ord(c) <= 0xDFFF for c in value):
        fail(reason)
    return value


def absolute_url(value, base=None):
    value = text_value(value, "invalid_url")
    if "\\" in value or any(c.isspace() for c in value):
        fail("invalid_url")
    try:
        u = urlsplit(urljoin(base, value) if base else value)
        if u.scheme not in ("http", "https") or not u.hostname or u.username is not None or u.password is not None:
            fail("invalid_url")
        _ = u.port
    except (ValueError, TypeError):
        fail("invalid_url")
    return urlunsplit((u.scheme, u.netloc, u.path or "/", u.query, u.fragment))


def schema_term(value):
    if not plain(value):
        return None
    for prefix in ("https://schema.org/", "http://schema.org/"):
        if value.startswith(prefix):
            return value[len(prefix):]
    return value if ":" not in value and "/" not in value else None


def types(node):
    value = node.get("@type", [])
    values = value if isinstance(value, list) else [value]
    return [schema_term(v) for v in values]


class ScriptCollector(HTMLParser):
    """Extract inline script text, suppressing inert/raw-text/foreign content.

    HTMLParser is not a browser DOM. Its supported envelope is documented. Raw
    text is retained exactly; entities in script contents are never decoded.
    """
    RAW = frozenset(("textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript", "plaintext"))
    INERT = frozenset(("template", "svg", "math"))

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.blocks = []
        self.raw = None
        self.inert = []
        self.script = None
        self.script_index = 0
        self.active_script = False
        self.script_tail = ""

    def handle_starttag(self, tag, attrs):
        if self.raw:
            return
        if tag == "base":
            fail("base_url_markup_unsupported")
        if tag in ("svg", "math"):
            fail("foreign_markup_unsupported")
        if tag in ("frameset", "frame"):
            fail("frameset_markup_unsupported")
        if tag in self.RAW:
            self.raw = tag
            return
        if tag in self.INERT:
            self.inert.append(tag)
            return
        if tag != "script":
            return
        self.active_script = True
        self.script_tail = ""
        index = self.script_index
        self.script_index += 1
        # HTMLParser enters script CDATA even when this callback ignores it.
        if self.inert:
            return
        keys = [key for key, _ in attrs]
        data = dict(attrs)
        if len(keys) != len(set(keys)):
            fail("duplicate_script_attribute", "ambiguous")
        media_type = (data.get("type") or "").strip().lower()
        if media_type != "application/ld+json":
            return
        if "src" in data:
            fail("external_jsonld_unsupported")
        if len(self.blocks) >= MAX_BLOCKS:
            fail("resource_limit")
        self.script = {"index": index, "line": self.getpos()[0], "column": self.getpos()[1], "chunks": [], "size": 0}

    def handle_startendtag(self, tag, attrs):
        # In HTML a self-closing slash does not close a script element. Refuse
        # rather than relying on HTMLParser's different recovery semantics.
        if tag == "script" and not self.raw:
            fail("self_closing_script_unsupported")
        if tag in self.RAW or tag in self.INERT or tag == "style":
            fail("self_closing_raw_or_inert_tag_unsupported")
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if self.raw:
            if tag == self.raw and self.raw != "plaintext":
                self.raw = None
            return
        if tag == "script":
            self.active_script = False
            self.script_tail = ""
        if tag == "script" and self.script is not None:
            self.script["text"] = "".join(self.script.pop("chunks"))
            self.blocks.append(self.script)
            self.script = None
        if tag in self.INERT and tag in self.inert:
            # Broken nesting is not safe to interpret as live product markup.
            if self.inert[-1] != tag:
                fail("malformed_inert_markup")
            self.inert.pop()

    def unknown_decl(self, data):
        fail("unknown_markup_declaration")

    def handle_data(self, data):
        if self.active_script:
            combined = self.script_tail + data
            if "<!--" in combined:
                fail("script_escape_markup_unsupported")
            self.script_tail = combined[-3:]
        if self.script is not None:
            self.script["size"] += len(data.encode("utf-8"))
            if self.script["size"] > MAX_JSON_BYTES:
                fail("resource_limit")
            self.script["chunks"].append(data)


def validate_comments(html):
    # HTMLParser accepts/recoveries from malformed comments differently from an
    # HTML5 tokenizer. Only the ordinary <!-- text --> envelope is supported.
    position = 0
    while True:
        start = html.find("<!--", position)
        if start < 0:
            return
        end = html.find("-->", start + 4)
        if end < 0:
            fail("malformed_comment_unsupported")
        body = html[start + 4:end]
        if body.startswith((">", "->")) or "--" in body:
            fail("malformed_comment_unsupported")
        position = end + 3


def strict_json(raw):
    # Bound nesting BEFORE json.loads, including brackets hidden inside strings.
    depth, quoted, escaped = 0, False, False
    for c in raw:
        if quoted:
            if escaped:
                escaped = False
            elif c == "\\":
                escaped = True
            elif c == '"':
                quoted = False
        elif c == '"':
            quoted = True
        elif c in "[{":
            depth += 1
            if depth > MAX_DEPTH:
                fail("resource_limit")
        elif c in "]}":
            depth -= 1
    def pairs(items):
        node = {}
        for key, value in items:
            if key in node:
                fail("duplicate_json_key", "ambiguous")
            node[key] = value
        return node
    def constant(_):
        fail("malformed_jsonld")
    try:
        return json.loads(raw, object_pairs_hook=pairs, parse_int=JsonNumber,
                          parse_float=JsonNumber, parse_constant=constant)
    except (ValueError, RecursionError):
        fail("malformed_jsonld")


def amount(value):
    if not isinstance(value, str) or not DECIMAL.fullmatch(value):
        fail("invalid_price")
    integer, _, fraction = value.partition(".")
    fraction = fraction.rstrip("0")
    canonical = integer + ("." + fraction if fraction else "")
    coefficient = (integer + fraction).lstrip("0") or "0"
    return {"amount": canonical, "coefficient": coefficient, "scale": len(fraction)}


def singleton(value, reason):
    if isinstance(value, list):
        if len(value) != 1:
            fail(reason, "ambiguous" if len(value) > 1 else "unsupported")
        return value[0]
    return value


def extract_price(html: str, *, page_url: str) -> dict:
    """Return {status: ok, snapshot: ...} or a conservative rejection.

    page_url must identify the already-fetched HTML, preferably its verified final
    URL. No URL is visited. See README for exact supported scope and non-goals.
    """
    try:
        return _extract(html, page_url)
    except Rejected as error:
        return {"status": error.status, "reason": error.reason}
    except (UnicodeError, RecursionError):
        return {"status": "unsupported", "reason": "invalid_encoding_or_resource_limit"}


def _extract(html, page_url):
    page_url = absolute_url(page_url)
    page_url = page_url.split("#", 1)[0]
    if not plain(html):
        fail("html_string_required")
    if len(html) > MAX_HTML_BYTES or len(html.encode("utf-8")) > MAX_HTML_BYTES:
        fail("resource_limit")
    validate_comments(html)
    collector = ScriptCollector()
    try:
        collector.feed(html)
        collector.close()
    except AssertionError:
        fail("malformed_html_declaration")
    if collector.script is not None:
        fail("unterminated_jsonld_script")
    if not collector.blocks:
        fail("no_jsonld")
    nodes, references, products, groups = [], {}, [], []
    count = 0
    for block in collector.blocks:
        root = strict_json(block["text"])
        if not isinstance(root, (dict, list)):
            fail("invalid_jsonld_root")
        pending = [(root, "$", None, 0)]
        while pending:
            node, pointer, context, depth = pending.pop()
            count += 1
            if count > MAX_NODES or depth > MAX_DEPTH:
                fail("resource_limit")
            if isinstance(node, list):
                pending.extend((v, f"{pointer}[{i}]", context, depth + 1) for i, v in enumerate(node))
                continue
            if not isinstance(node, dict):
                continue
            if "@context" in node:
                context = node["@context"]
                if not plain(context) or context not in CONTEXTS:
                    fail("custom_or_missing_context")
            if context not in CONTEXTS:
                fail("custom_or_missing_context")
            if any(":" in k for k in node):
                fail("expanded_property_names_unsupported")
            if "@graph" in node and (set(node) != {"@context", "@graph"} or depth != 0 or not isinstance(node["@graph"], list)):
                fail("named_or_nested_graph_unsupported")
            if any(k.startswith("@") and k not in ("@context", "@type", "@id", "@graph") for k in node):
                fail("advanced_jsonld_unsupported")
            entry = (node, pointer, block)
            nodes.append(entry)
            if "@id" in node:
                ident = absolute_url(node["@id"], page_url)
                # A bare @id is a reference; definitions must be unique.
                if any(k != "@id" for k in node):
                    if ident in references:
                        fail("duplicate_node_id", "ambiguous")
                    references[ident] = entry
            node_types = types(node)
            if "Product" in node_types:
                if node_types != ["Product"]:
                    fail("mixed_product_type_unsupported")
                products.append(entry)
            if "ProductGroup" in node_types:
                groups.append(entry)
            pending.extend((v, f"{pointer}.{k}", context, depth + 1) for k, v in node.items() if k != "@context")
    if groups:
        fail("product_groups_unsupported", "ambiguous")
    if len(products) != 1:
        fail("multiple_products" if products else "no_product", "ambiguous" if products else "unsupported")
    product, product_path, product_block = products[0]
    if "hasVariant" in product:
        fail("variant_selection_required", "ambiguous")
    if any(key in product for key in ("additionalProperty", "hasMeasurement", "isAccessoryOrSparePartFor")):
        fail("custom_variant_or_product_relationship_unsupported")
    if set(product) - PRODUCT_FIELDS:
        fail("unsupported_product_field")
    identifiers = {}
    for key in ID_FIELDS:
        if key in product:
            identifiers[key] = text_value(product[key], "invalid_product_identity")
    for key in ("@id", "url"):
        if key in product:
            identifiers[key] = absolute_url(product[key], page_url)
    if not identifiers:
        fail("stable_product_identity_required")
    variant = {}
    for key in VARIANT_FIELDS:
        if key in product:
            variant[key] = text_value(product[key], "ambiguous_variant")
    if "isVariantOf" in product:
        parent = product["isVariantOf"]
        if isinstance(parent, dict) and set(parent) == {"@id"}:
            parent = parent["@id"]
        variant["isVariantOf"] = absolute_url(parent, page_url)
        if "sku" not in identifiers:
            fail("variant_sku_required")
    value = singleton(product.get("offers"), "multiple_offers")
    offer_path, offer_block = product_path + ".offers", product_block
    if isinstance(product.get("offers"), list):
        offer_path += "[0]"
    if not isinstance(value, dict):
        fail("offer_required")
    if set(value) == {"@id"}:
        ident = absolute_url(value["@id"], page_url)
        if ident not in references:
            fail("unresolved_offer_reference")
        value, offer_path, offer_block = references[ident]
    offer = value
    if "AggregateOffer" in types(offer) or any(key in offer for key in ("lowPrice", "highPrice", "offerCount")):
        fail("aggregate_price_unsupported", "ambiguous")
    if types(offer) != ["Offer"]:
        fail("single_offer_type_required")
    if any(node is not offer and ("Offer" in types(node) or "AggregateOffer" in types(node)) for node, _, _ in nodes):
        fail("additional_offers_present", "ambiguous")
    if CONDITIONAL_FIELDS.intersection(offer):
        fail("conditional_price_unsupported")
    if "offers" in offer:
        fail("nested_offers_unsupported", "ambiguous")
    if set(offer) - OFFER_FIELDS:
        fail("unsupported_offer_field")
    if "itemOffered" in offer:
        offered = offer["itemOffered"]
        if not isinstance(offered, dict) or set(offered) != {"@id"} or "@id" not in identifiers:
            fail("item_offered_unverified")
        if absolute_url(offered["@id"], page_url) != identifiers["@id"]:
            fail("item_offered_mismatch", "ambiguous")
    for key in ID_FIELDS:
        if key in offer and (key not in identifiers or offer[key] != identifiers[key]):
            fail("offer_product_identity_mismatch", "ambiguous")
    price = amount(offer.get("price"))
    currency = offer.get("priceCurrency")
    if not plain(currency) or currency not in CURRENCIES:
        fail("unsupported_or_missing_currency")
    availability = schema_term(offer.get("availability"))
    if availability not in AVAILABILITIES:
        fail("unsupported_or_missing_availability")
    offer_identity = {}
    for key in ("@id", "url"):
        if key in offer:
            offer_identity[key] = absolute_url(offer[key], page_url)
    if "seller" in offer:
        seller = offer["seller"]
        if not isinstance(seller, dict):
            fail("seller_identity_required")
        if set(seller) == {"@id"}:
            seller_id = absolute_url(seller["@id"], page_url)
            if seller_id not in references:
                fail("unresolved_seller_reference")
            seller = references[seller_id][0]
        if set(seller) - {"@context", "@type", "@id", "url", "name", "legalName"}:
            fail("complex_seller_identity_unsupported")
        seller_identity = {}
        for key in ("@id", "url"):
            if key in seller:
                seller_identity[key] = absolute_url(seller[key], page_url)
        if not seller_identity:
            fail("seller_identity_required")
        for key in ("name", "legalName"):
            if key in seller:
                seller_identity[key] = text_value(seller[key], "invalid_seller_identity")
        offer_identity["seller"] = seller_identity
    for owner in (product, offer):
        if "itemCondition" in owner:
            condition = schema_term(owner["itemCondition"])
            if condition not in CONDITIONS:
                fail("unsupported_item_condition")
            if "itemCondition" in offer_identity and offer_identity["itemCondition"] != condition:
                fail("conflicting_item_condition", "ambiguous")
            offer_identity["itemCondition"] = condition
    return {"status": "ok", "snapshot": {
        "schema": SCHEMA,
        "page_url": page_url,
        "product": {"identifiers": identifiers, "variant": variant},
        "offer": offer_identity,
        "price": {**price, "currency": currency},
        "availability": availability,
        "evidence": {
            "method": "jsonld-product-offer",
            "product_script_index": product_block["index"],
            "offer_script_index": offer_block["index"],
            "product_path": product_path,
            "offer_path": offer_path,
            "price_path": offer_path + ".price",
            "script_line": offer_block["line"],
            "raw_price": str(offer["price"]),
            "raw_price_type": "number" if isinstance(offer["price"], JsonNumber) else "string",
            "raw_currency": currency,
            "raw_availability": offer["availability"],
        },
    }}


def _valid_snapshot(snapshot):
    if not isinstance(snapshot, dict) or snapshot.get("schema") != SCHEMA:
        return False
    try:
        if absolute_url(snapshot["page_url"]) != snapshot["page_url"] or "#" in snapshot["page_url"]:
            return False
        product, offer, price = snapshot["product"], snapshot["offer"], snapshot["price"]
        if not isinstance(product, dict) or set(product) != {"identifiers", "variant"}:
            return False
        identifiers, variant = product["identifiers"], product["variant"]
        if not isinstance(identifiers, dict) or not identifiers or not isinstance(variant, dict) or not isinstance(offer, dict):
            return False
        if not set(identifiers) <= set(ID_FIELDS + ("@id", "url")) or not set(variant) <= set(VARIANT_FIELDS + ("isVariantOf",)):
            return False
        for key, value in identifiers.items():
            if key in ("@id", "url"):
                absolute_url(value)
            else:
                text_value(value, "invalid_snapshot")
        for key, value in variant.items():
            absolute_url(value) if key == "isVariantOf" else text_value(value, "invalid_snapshot")
        if "isVariantOf" in variant and "sku" not in identifiers:
            return False
        if not set(offer) <= {"@id", "url", "seller", "itemCondition"}:
            return False
        for key, value in offer.items():
            if key in ("@id", "url"):
                absolute_url(value)
            elif key == "itemCondition":
                if value not in CONDITIONS:
                    return False
            else:
                if not isinstance(value, dict) or not ({"@id", "url"} & set(value)) or not set(value) <= {"@id", "url", "name", "legalName"}:
                    return False
                for key, field in value.items():
                    absolute_url(field) if key in ("@id", "url") else text_value(field, "invalid_snapshot")
        if not isinstance(price, dict) or set(price) != {"amount", "coefficient", "scale", "currency"}:
            return False
        parsed = amount(price["amount"])
        if any(price[k] != parsed[k] for k in parsed) or type(price["scale"]) is not int:
            return False
        evidence = snapshot.get("evidence")
        if not isinstance(evidence, dict) or evidence.get("method") != "jsonld-product-offer":
            return False
        if evidence.get("raw_price_type") not in ("number", "string"):
            return False
        if amount(evidence.get("raw_price")) != parsed or evidence.get("raw_currency") != price["currency"]:
            return False
        if schema_term(evidence.get("raw_availability")) != snapshot["availability"]:
            return False
        for key in ("product_script_index", "offer_script_index", "script_line"):
            if type(evidence.get(key)) is not int or evidence[key] < (1 if key == "script_line" else 0):
                return False
        for key in ("product_path", "offer_path", "price_path"):
            text_value(evidence.get(key), "invalid_snapshot")
        if evidence["price_path"] != evidence["offer_path"] + ".price":
            return False
        return plain(price["currency"]) and price["currency"] in CURRENCIES and snapshot["availability"] in AVAILABILITIES
    except (KeyError, TypeError, ValueError, Rejected):
        return False


def compare_prices(previous: dict, current: dict) -> dict:
    """Compare validated snapshots; changes to HTML/description never count.

    Availability transitions are reported separately. A price event is suppressed
    unless BOTH observations say InStock. No state is mutated or baseline chosen.
    """
    if not _valid_snapshot(previous) or not _valid_snapshot(current):
        return {"status": "incomparable", "reason": "invalid_snapshot"}
    for field in ("page_url", "product", "offer"):
        if previous[field] != current[field]:
            return {"status": "incomparable", "reason": field + "_changed"}
    a, b = previous["price"], current["price"]
    if a["currency"] != b["currency"]:
        return {"status": "incomparable", "reason": "currency_changed"}
    availability_changed = previous["availability"] != current["availability"]
    details = {"availability_changed": availability_changed,
               "previous_availability": previous["availability"], "current_availability": current["availability"]}
    if previous["availability"] != "InStock" or current["availability"] != "InStock":
        return {"status": "not_comparable_price", "reason": "both_observations_must_be_in_stock", **details}
    scale = max(a["scale"], b["scale"])
    left = int(a["coefficient"]) * 10 ** (scale - a["scale"])
    right = int(b["coefficient"]) * 10 ** (scale - b["scale"])
    return {"status": "price_decreased" if right < left else "price_increased" if right > left else "unchanged",
            "previous_amount": a["amount"], "current_amount": b["amount"], "currency": a["currency"], **details}
