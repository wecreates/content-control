// Display-only projection. Configuration and past reads never imply a live account grant.
export function runtimeView(data = {}) {
  const health = data.storage_health || {};
  const receipt = data.storage_bootstrap || {};
  const locked = data.publication_enabled === false && data.external_writes_enabled === false;
  const expiry = typeof data.storage_expires_at === 'string' && Number.isFinite(Date.parse(data.storage_expires_at)) ? data.storage_expires_at : null;
  const storage = health.operations_blocked ? 'Storage blocked: ' + (health.reason_code || health.status || 'check required') : receipt.read_verified === true ? 'Encrypted storage was read successfully at startup.' : 'Encrypted storage has not been verified.';
  const authorization = Object.entries(data.authorization_configuration || {}).map(([platform, config]) => {
    const missing = Array.isArray(config.missing_configuration) ? config.missing_configuration : [];
    return {platform, text: missing.length ? 'Setup incomplete: ' + missing.join(', ') : 'Settings present; account authorization still requires verification.'};
  });
  return {locked, storage, expiry,
    observed: health.last_read_verified_at || receipt.checked_at || null,
    scope: 'Startup evidence only. Current database availability and social-account access are not proven by this check.',
    authorization};
}
