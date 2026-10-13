CREATE TABLE IF NOT EXISTS pod_artifacts (
 sha256 text PRIMARY KEY CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 body bytea NOT NULL CHECK(octet_length(body)<=16777216),
 media_type text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pod_financial_events (
 id uuid PRIMARY KEY,
 job_id uuid NOT NULL REFERENCES pod_production_queue(id),
 provider text NOT NULL, provider_event_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('royalty','refund','fee','production_cost','generation_cost','tax','adjustment')),
 amount_minor bigint NOT NULL,
 currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 occurred_at timestamptz NOT NULL,
 evidence_sha256 text NOT NULL REFERENCES pod_artifacts(sha256),
 authority_event_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider,provider_event_id)
);
CREATE INDEX IF NOT EXISTS pod_financial_job ON pod_financial_events(job_id,currency);
CREATE OR REPLACE FUNCTION pod_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'POD_APPEND_ONLY'; END; $$;
CREATE TRIGGER pod_financial_immutable BEFORE UPDATE OR DELETE ON pod_financial_events FOR EACH ROW EXECUTE FUNCTION pod_immutable_record();
CREATE TRIGGER pod_artifact_immutable BEFORE UPDATE OR DELETE ON pod_artifacts FOR EACH ROW EXECUTE FUNCTION pod_immutable_record();
