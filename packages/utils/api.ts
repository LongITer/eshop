import { RequestHandler } from 'express';
import { ValidationError } from '@packages/error-handler';

export const handle = (fn: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
export function objectId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw new ValidationError('Invalid ID');
  return value;
}
export function textField(value: unknown, name: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new ValidationError(`Invalid ${name}`);
  return value.trim();
}
export function pageArgs(query: Record<string, unknown>) {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);
  const page = Number.isFinite(rawPage) ? Math.min(1_000_000, Math.max(1, rawPage || 1)) : 1;
  const take = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit || 20)) : 20;
  return { skip: (Math.floor(page) - 1) * Math.floor(take), take: Math.floor(take) };
}
