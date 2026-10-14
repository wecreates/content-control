# POD deployment preflight

Run `node scripts/pod_preflight.mjs` inside the deployment environment before enabling POD service or production. It emits one redacted JSON report; exit 1 means configuration is blocked. It does not migrate, create roles, change flags, access vault rows, or publish.

Supply POD_DATABASE_URL for a dedicated restricted runtime role, POD_BRIDGE_PATH for the existing Money Factory bridge, POD_STORAGE_EXPIRES_AT, POD_UPSTREAM_KEY, POD_QA_KEY, and INTERNAL_OPERATIONS_KEY. Keep PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED false. Never substitute the social database owner credentials. Run the separate existing storage migration with the migration role before checking schema compatibility.

The database probe opens a read-only transaction with bounded statement/lock timeouts and rolls it back. It checks TLS, elevated role membership, database/schema creation rights, POD table grants and ownership, social vault table/column access, and both migration checksums. Output contains fixed check codes, never connection strings or raw database exceptions.

CONFIGURATION_VERIFIED proves only these configuration checks. It does not prove a continuously available worker, installed Python dependencies, production resolvers, rights clearance, editorial or comparative QA, marketplace adapter authorization, or revenue. Those remain explicit unverified fields in the report. The command never enables publication. A missing/expiring storage deadline blocks even when the database can be reached.
