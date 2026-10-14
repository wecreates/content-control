-- One provider listing belongs to one job within its marketplace/account.
-- Existing duplicates fail migration; never rewrite listing or financial history.
CREATE UNIQUE INDEX pod_provider_listing_once
 ON pod_production_queue(platform,account_id,provider_id)
 WHERE provider_id IS NOT NULL;
