-- Preserve rank provenance without modifying or fabricating legacy observations.
ALTER TABLE pod_market_intelligence ADD COLUMN rank_evidence_sha256 text
 CHECK(rank_evidence_sha256 ~ '^[a-f0-9]{64}$') REFERENCES pod_artifacts(sha256);
-- Corrections require a new observed_at and fresh authoritative evidence.
CREATE TRIGGER pod_market_immutable BEFORE UPDATE OR DELETE ON pod_market_intelligence
 FOR EACH ROW EXECUTE FUNCTION pod_immutable_record();
