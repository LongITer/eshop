// Catalog prices are USD. Do not infer a currency from a customer's address.
export const STORE_CURRENCY = 'usd';
export function usdCents(amount: number): number {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents)) throw new Error('Invalid USD amount');
  return cents;
}
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}
