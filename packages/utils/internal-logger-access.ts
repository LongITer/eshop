import { timingSafeEqual } from 'node:crypto';
export function mayReadInternalLogs(header: unknown, configuredToken = process.env.LOGGER_INTERNAL_TOKEN) {
  if (!configuredToken || configuredToken.length < 32 || typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7)), expected = Buffer.from(configuredToken);
  return supplied.length === expected.length && timingSafeEqual(Uint8Array.from(supplied), Uint8Array.from(expected));
}
