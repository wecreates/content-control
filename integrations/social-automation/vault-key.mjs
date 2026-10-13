// Existing hexadecimal keys and canonical RFC 4648 base64 encode the same
// 32-byte AES key. Never trim, pad, or silently repair malformed configuration.
export function parseVaultKey(value) {
  if (typeof value === 'string') {
    if (/^[a-fA-F0-9]{64}$/.test(value)) return Buffer.from(value, 'hex');
    if (/^[A-Za-z0-9+/]{43}=$/.test(value)) {
      const decoded = Buffer.from(value, 'base64');
      if (decoded.length === 32 && decoded.toString('base64') === value) return decoded;
    }
  }
  throw Error('PRIVATE_STORE_CONFIGURATION_REQUIRED');
}
