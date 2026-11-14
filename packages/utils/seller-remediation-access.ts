/** Suspended sellers cannot sell, but retain narrowly scoped access to remedy existing purchases. */
export function sellerRemediationRequest(path: string, method: string) {
  const route = path.replace(/^\/api(?=\/)/, '');
  if (method === 'GET') return ['/logged-in-seller', '/get-seller-orders', '/seller-payments', '/seller-violations', '/seller-moderation-tasks', '/get-seller-notifications'].includes(route) || /^\/seller-aftercare\/[a-f\d]{24}$/i.test(route);
  if (method === 'PATCH') return /^\/(?:seller-moderation-tasks|update-order-status|returns|notifications)\/[a-f\d]{24}(?:\/read)?$/i.test(route) || route === '/notifications/read-all';
  return method === 'POST' && /^\/seller-refund\/[a-f\d]{24}$/i.test(route);
}
