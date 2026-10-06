import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import redis from '@packages/libs/redis';
import db, { resetDb } from './mocks/prisma';
import { userId } from './helpers';
import { errorMiddleware } from '@packages/error-handler/error-middleware';
const google = { generateCodeVerifierAsync: jest.fn(), generateAuthUrl: jest.fn(), getToken: jest.fn(), verifyIdToken: jest.fn() };
jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn(() => google) }));
const { googleStart, googleCallback } = require('../../apps/auth-service/src/controllers/google.controller');
const app = express(); app.use(cookieParser()); app.get('/api/auth/google', googleStart); app.get('/api/auth/google/callback', googleCallback); app.use(errorMiddleware);
const state = 'a'.repeat(64);
beforeEach(() => {
  resetDb(); jest.clearAllMocks(); process.env.GOOGLE_CLIENT_ID = 'test-client'; process.env.GOOGLE_CLIENT_SECRET = 'test-secret'; process.env.GOOGLE_REDIRECT_URI = 'http://localhost/api/auth/google/callback';
  (redis.getdel as jest.Mock).mockResolvedValue(JSON.stringify({ nonce: 'nonce', codeVerifier: 'verifier' }));
  google.getToken.mockResolvedValue({ tokens: { id_token: 'verified-token' } });
  google.verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'subject', email: 'buyer@gmail.com', email_verified: true, nonce: 'nonce', name: 'Buyer' }) });
});
const callback = () => request(app).get(`/api/auth/google/callback?state=${state}&code=code`).set('Cookie', `oauth_state=${state}`);
test('start stores a one-time state and uses PKCE and nonce', async () => {
  google.generateCodeVerifierAsync.mockResolvedValue({ codeVerifier: 'v', codeChallenge: 'c' }); google.generateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth');
  const result = await request(app).get('/api/auth/google');
  expect(result.status).toBe(302); expect(result.headers['set-cookie'][0]).toContain('HttpOnly');
  expect(google.generateAuthUrl.mock.calls[0][0]).toEqual(expect.objectContaining({ code_challenge: 'c', code_challenge_method: 'S256', nonce: expect.any(String), state: expect.any(String) }));
  expect(redis.set).toHaveBeenCalledWith(expect.stringMatching(/^oauth:/), expect.any(String), 'EX', 600);
});
test('callback rejects a state from another browser', async () => {
  expect((await request(app).get(`/api/auth/google/callback?state=${state}&code=code`)).status).toBe(401);
  expect(google.getToken).not.toHaveBeenCalled();
});
test('callback cannot replay a consumed state', async () => {
  (redis.getdel as jest.Mock).mockResolvedValue(null);
  expect((await callback()).status).toBe(401); expect(google.getToken).not.toHaveBeenCalled();
});
test.each([{ email_verified: false }, { nonce: 'wrong' }])('rejects unverified email or mismatched nonce', async invalid => {
  google.verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 's', email: 'buyer@gmail.com', email_verified: true, nonce: 'nonce', ...invalid }) });
  expect((await callback()).status).toBe(401); expect(db.users.create).not.toHaveBeenCalled();
});
test('existing Google identity logs into same user without creating duplicates', async () => {
  db.oauthIdentity.findUnique.mockResolvedValue({ userId }); db.users.findUniqueOrThrow.mockResolvedValue({ id: userId, role: 'user' });
  const result = await callback(); expect(result.status).toBe(302); expect(result.headers['set-cookie'].some((value: string) => value.startsWith('access_token='))).toBe(true); expect(db.users.create).not.toHaveBeenCalled();
});
test('verified Gmail links an existing buyer account', async () => {
  db.oauthIdentity.findUnique.mockResolvedValue(null); db.users.findUnique.mockResolvedValue({ id: userId, role: 'user' });
  expect((await callback()).status).toBe(302); expect(db.users.create).not.toHaveBeenCalled();
  expect(db.oauthIdentity.create).toHaveBeenCalledWith({ data: { subject: 'subject', userId } });
});
test('third-party email does not silently take over an existing password account', async () => {
  db.oauthIdentity.findUnique.mockResolvedValue(null); db.users.findUnique.mockResolvedValue({ id: userId, role: 'user' });
  google.verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'subject', email: 'buyer@example.com', email_verified: true, nonce: 'nonce' }) });
  expect((await callback()).status).toBe(401); expect(db.oauthIdentity.create).not.toHaveBeenCalled();
});
test('new verified Google buyer receives one local account and identity link', async () => {
  db.oauthIdentity.findUnique.mockResolvedValue(null); db.users.findUnique.mockResolvedValue(null); db.users.create.mockResolvedValue({ id: userId, role: 'user' });
  expect((await callback()).status).toBe(302); expect(db.users.create).toHaveBeenCalledTimes(1); expect(db.oauthIdentity.create).toHaveBeenCalledTimes(1);
});
