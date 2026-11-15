export const adminRoles = ['owner', 'operations', 'support', 'finance', 'moderator'] as const;
export type AdminRole = typeof adminRoles[number];
export type AdminPermission = 'fulfillment' | 'overview' | 'orders' | 'payments' | 'catalog' | 'moderation' | 'accounts' | 'returns' | 'notifications' | 'logs' | 'settings' | 'team';
const grants: Record<AdminRole, readonly AdminPermission[]> = {
  owner: ['overview', 'catalog', 'moderation', 'accounts', 'notifications', 'settings', 'team'],
  operations: ['overview', 'catalog', 'moderation', 'accounts', 'notifications'],
  support: ['catalog', 'moderation', 'accounts', 'notifications'],
  finance: ['overview'],
  moderator: ['moderation'],
};
// Existing administrators retain owner access; an unknown explicit role fails closed.
export function canAdmin(account: { role?: string; adminRole?: string | null } | null | undefined, permission: AdminPermission) {
  return account?.role === 'admin' && !!grants[(account.adminRole ?? 'owner') as AdminRole]?.includes(permission);
}
export function isSuspended(account: { suspendedAt?: Date | string | null; suspendedUntil?: Date | string | null }, now = Date.now()) {
  return !!account.suspendedAt && (!account.suspendedUntil || new Date(account.suspendedUntil).getTime() > now);
}
