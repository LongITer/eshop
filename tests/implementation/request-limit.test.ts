import jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { requestLimit } from '../../apps/api-gateway/src/libs/request-limit';

const id = '111111111111111111111111';
const req = (cookies = {}, headers = {}) => ({ cookies, headers }) as Request;

test('guests and forged credentials retain the guest request limit', () => {
  expect(requestLimit(req())).toBe(100);
  expect(requestLimit(req({ access_token: jwt.sign({ id, role: 'user' }, 'wrong-secret') }))).toBe(100);
});

test.each(['user', 'seller', 'admin'])('signed %s sessions receive the authenticated limit without req.user', role => {
  const token = jwt.sign({ id, role }, process.env.ACCESS_TOKEN_JWT_SECRET!);
  expect(requestLimit(req({ [role === 'seller' ? 'seller_access_token' : 'access_token']: token }))).toBe(1000);
  expect(requestLimit(req({}, { authorization: `Bearer ${token}` }))).toBe(1000);
});

test('expired tokens and invalid roles retain the guest limit', () => {
  const secret = process.env.ACCESS_TOKEN_JWT_SECRET!;
  expect(requestLimit(req({ access_token: jwt.sign({ id, role: 'user' }, secret, { expiresIn: -1 }) }))).toBe(100);
  expect(requestLimit(req({ access_token: jwt.sign({ id, role: 'unknown' }, secret) }))).toBe(100);
});
