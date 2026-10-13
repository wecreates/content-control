CREATE TABLE IF NOT EXISTS pod_concepts (
 id uuid PRIMARY KEY, business_id text NOT NULL, fingerprint text NOT NULL UNIQUE,
 rights_state text NOT NULL CHECK(rights_state IN ('PASS','FAIL','UNKNOWN')),
 permanently_unpublished boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(rights_state='PASS' OR permanently_unpublished)
);
CREATE TABLE IF NOT EXISTS pod_market_intelligence (
 id uuid PRIMARY KEY, platform text NOT NULL CHECK(platform IN ('kdp','redbubble','teepublic','zazzle','spreadshirt')),
 source_url text NOT NULL, observed_at timestamptz NOT NULL,
 country char(2) NOT NULL, category text NOT NULL,
 image_sha256 text CHECK(image_sha256 ~ '^[a-f0-9]{64}$'),
 price_minor bigint CHECK(price_minor>=0), currency char(3),
 observed_rank integer CHECK(observed_rank>0),
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
 observations jsonb NOT NULL, UNIQUE(platform,source_url,observed_at)
);
CREATE TABLE IF NOT EXISTS pod_daily_concept_budget (
 business_id text NOT NULL, day date NOT NULL, used integer NOT NULL DEFAULT 0,
 PRIMARY KEY(business_id,day), CHECK(used>=0)
);
CREATE TABLE IF NOT EXISTS pod_accounts (
 id uuid PRIMARY KEY, platform text NOT NULL CHECK(platform IN ('kdp','redbubble','teepublic','zazzle','spreadshirt')),
 state text NOT NULL DEFAULT 'DISABLED' CHECK(state IN ('ACTIVE','DISABLED','CHALLENGED','AUTH_REQUIRED')),
 daily_cap integer NOT NULL DEFAULT 0 CHECK(daily_cap>=0),
 next_allowed_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,platform)
);
CREATE TABLE IF NOT EXISTS pod_production_queue (
 id uuid PRIMARY KEY, concept_id uuid NOT NULL REFERENCES pod_concepts(id),
 account_id uuid NOT NULL, platform text NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 state text NOT NULL DEFAULT 'raw' CHECK(state IN ('raw','processing','qa_passed','qa_failed','publishing','ambiguous','submitted','published','blocked')),
 brief jsonb NOT NULL, upstream_envelope jsonb NOT NULL,
 manifest jsonb, qa_envelope jsonb,
 idempotency_key text NOT NULL UNIQUE,
 attempt integer NOT NULL DEFAULT 0, fencing_token bigint NOT NULL DEFAULT 0,
 lease_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 provider_id text, reason_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(account_id,platform) REFERENCES pod_accounts(id,platform),
 UNIQUE(concept_id,account_id,revision)
);
CREATE UNIQUE INDEX IF NOT EXISTS pod_one_external_inflight ON pod_production_queue(account_id)
 WHERE state IN ('publishing','ambiguous');
CREATE INDEX IF NOT EXISTS pod_due ON pod_production_queue(state,next_attempt_at);
CREATE TABLE IF NOT EXISTS pod_quota_reservations (
 job_id uuid NOT NULL REFERENCES pod_production_queue(id), attempt integer NOT NULL,
 account_id uuid NOT NULL REFERENCES pod_accounts(id), reserved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(job_id,attempt)
);
CREATE TABLE IF NOT EXISTS pod_events (
 id uuid PRIMARY KEY, job_id uuid REFERENCES pod_production_queue(id),
 kind text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz
);
CREATE TABLE IF NOT EXISTS pod_provider_inbox (
 provider text NOT NULL, account_id uuid NOT NULL REFERENCES pod_accounts(id),
 provider_event_id text NOT NULL, evidence_sha256 text NOT NULL,
 payload jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(provider,account_id,provider_event_id)
);
CREATE OR REPLACE FUNCTION pod_preserve_tombstone() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.permanently_unpublished AND (NOT NEW.permanently_unpublished OR NEW.rights_state<>OLD.rights_state) THEN
  RAISE EXCEPTION 'POD_PERMANENTLY_UNPUBLISHED';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS pod_tombstone ON pod_concepts;
CREATE TRIGGER pod_tombstone BEFORE UPDATE ON pod_concepts FOR EACH ROW EXECUTE FUNCTION pod_preserve_tombstone();
