# POD deployment preflight

Run `node scripts/pod_preflight.mjs` inside the deployment environment before enabling POD service or production. It emits one redacted JSON report; exit 1 means configuration is blocked. It does not migrate, create roles, change flags, access vault rows, or publish.

Supply POD_DATABASE_URL for a dedicated restricted runtime role, POD_BRIDGE_PATH for the existing Money Factory bridge, canonical UTC POD_STORAGE_EXPIRES_AT (`YYYY-MM-DDTHH:mm:ssZ` or exact millisecond ISO text), POD_UPSTREAM_KEY, POD_QA_KEY, and INTERNAL_OPERATIONS_KEY. Date-only, offset or otherwise normalized expiry text is invalid. Keep PUBLICATION_ENABLED and POD_PUBLICATION_ENABLED false. Never substitute the social database owner credentials. Run the separate existing storage migration with the migration role before checking schema compatibility. The migration revokes the database-level PUBLIC `TEMPORARY` grant, and preflight rejects any direct or reachable role that can create temporary relations; this prevents PostgreSQL's implicit `pg_temp` lookup from shadowing POD tables.

The bridge path must name one nonempty regular UTF-8 JSON file of at most 64
KiB. Service startup, deployment preflight, publication and both recovery tools
open it nonblocking without following a final symlink, then reject duplicate
decoded keys before validating every required Money Factory fail-closed rule.
Named pipes, devices, directories, linked files, changing sizes and ambiguous
JSON never become authority configuration.

The database probe opens a read-only transaction with bounded statement/lock timeouts and rolls it back. It checks TLS, elevated role membership, database/schema creation rights, POD table grants and ownership, social vault table/column access, and both migration checksums. Output contains fixed check codes, never connection strings or raw database exceptions.

CONFIGURATION_VERIFIED proves only these configuration checks. It does not prove a continuously available worker, installed Python dependencies, production resolvers, rights clearance, editorial or comparative QA, marketplace adapter authorization, or revenue. Those remain explicit unverified fields in the report. The command never enables publication. A missing/expiring storage deadline blocks even when the database can be reached.
