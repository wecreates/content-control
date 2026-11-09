// An operator assertion, not evidence of durability, availability or perpetual free service.
// No implicit non-expiring mode: every PostgreSQL deployment must choose a policy.
export function parseStorageRetention({retentionPolicy, expiresAt} = {}) {
  if (retentionPolicy === undefined || retentionPolicy === '') throw Error('STORAGE_RETENTION_POLICY_REQUIRED');
  if (!['fixed_expiry', 'no_fixed_expiry'].includes(retentionPolicy)) throw Error('STORAGE_RETENTION_POLICY_INVALID');
  if (retentionPolicy === 'no_fixed_expiry') {
    // A stale deadline must not be silently ignored when switching providers.
    if (expiresAt !== undefined) throw Error('STORAGE_RETENTION_POLICY_CONFLICT');
    return {retentionPolicy, expiry: null};
  }
  const expiry = typeof expiresAt === 'string' && expiresAt.trim() ? Date.parse(expiresAt) : NaN;
  if (!Number.isFinite(expiry)) throw Error('STORAGE_EXPIRY_REQUIRED');
  return {retentionPolicy, expiry};
}
