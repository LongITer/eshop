import jwt from 'jsonwebtoken';
import type { Request } from 'express';

export function requestLimit(req: Request): number {
  const token = req.headers.authorization?.split(' ')[1]
    || req.cookies?.access_token || req.cookies?.seller_access_token;
  const secret = process.env.ACCESS_TOKEN_JWT_SECRET;
  if (!token || !secret) return 100;
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload !== 'string' && /^[a-f\d]{24}$/i.test(payload.id)
      && ['user', 'seller', 'admin'].includes(payload.role)) return 1000;
  } catch {
    // Invalid and expired credentials retain the guest limit.
  }
  return 100;
}
