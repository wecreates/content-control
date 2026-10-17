# POD runtime credential isolation

Deployment preflight and service startup use the same credential policy. The
upstream grant, independent QA and internal operations credentials are required.
Every configured intake, finance, market, provider, registry, rights, template,
competitive review, source, editorial, grant transport and outbox credential must
also contain at least 32 UTF-8 bytes and differ from every other configured
credential in those scopes. Comparison uses the bytes consumed by HMAC.

Missing or empty optional credentials remain unavailable to their individual
feature gates; this check does not enable those features. Weak nonempty optional
credentials block startup even when that feature is disabled. Keep obsolete
credentials unset. The separately retained archive encryption key is outside
this runtime signing/transport policy.

Preflight reports only `POD_KEY_ISOLATION: PASS` or `BLOCKED`. Startup rejects
invalid keys before borrowing a database connection and requires one passing
isolation check in its report. It never returns credential values or hashes.

This verifies local configuration separation, not entropy, secure custody,
rotation, deployed configuration, or independent reviewer operation. Standalone
Python evidence tools still require their own authorized, independently held
keys. Live security acceptance remains open until the owner-controlled deployment
and operational evidence are verified. Both publication flags remain false.
