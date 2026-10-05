import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '@packages/libs/prisma';
import redis from '@packages/libs/redis';
import { handle } from '@packages/utils/api';
import { AuthError, AppError } from '@packages/error-handler';
import { setCookie } from '../utils/cookies/setCookies';

function oauthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) throw new AppError('Google sign-in is not configured', 503);
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
}
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/auth/google' };
export const googleStart = handle(async (_req, res) => {
  const client = oauthClient();
  const state = crypto.randomBytes(32).toString('hex');
  const nonce = crypto.randomBytes(32).toString('hex');
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  await redis.set(`oauth:${state}`, JSON.stringify({ nonce, codeVerifier }), 'EX', 600);
  res.cookie('oauth_state', state, { ...cookieOptions, maxAge: 600000 });
  res.redirect(client.generateAuthUrl({ scope: ['openid', 'email', 'profile'], state, nonce, code_challenge: codeChallenge, code_challenge_method: 'S256' as any, access_type: 'online' }));
});
export const googleCallback = handle(async (req, res) => {
  const client = oauthClient();
  const state = req.query.state;
  if (typeof state !== 'string' || !/^[a-f\d]{64}$/.test(state) || state !== req.cookies?.oauth_state) throw new AuthError('Invalid Google sign-in state');
  res.clearCookie('oauth_state', cookieOptions);
  const stored = await redis.getdel(`oauth:${state}`);
  if (!stored || typeof req.query.code !== 'string') throw new AuthError('Google sign-in expired or was cancelled');
  const { nonce, codeVerifier } = JSON.parse(stored);
  const { tokens } = await client.getToken({ code: req.query.code, codeVerifier });
  if (!tokens.id_token) throw new AuthError('Missing Google identity');
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
  const identity = ticket.getPayload() as any;
  if (!identity?.sub || !identity.email_verified || !identity.email || identity.nonce !== nonce) throw new AuthError('Google identity could not be verified');
  const email = String(identity.email).toLowerCase();
  const user = await prisma.$transaction(async tx => {
    const linked = await tx.oauthIdentity.findUnique({ where: { subject: identity.sub } });
    if (linked) return tx.users.findUniqueOrThrow({ where: { id: linked.userId } });
    let account = await tx.users.findUnique({ where: { email } });
    // Google must be authoritative for an existing account's email before automatic linking.
    if (account && !email.endsWith('@gmail.com') && !identity.hd) throw new AuthError('Sign in with your existing password to use this account');
    if (account?.role === 'admin') throw new AuthError('Use the administrator sign-in page');
    if (!account) account = await tx.users.create({ data: { email, name: String(identity.name || email.split('@')[0]).slice(0, 100), following: [] } });
    await tx.oauthIdentity.create({ data: { subject: identity.sub, userId: account.id } });
    return account;
  });
  setCookie(res, 'access_token', jwt.sign({ id: user.id, role: 'user' }, process.env.ACCESS_TOKEN_JWT_SECRET!, { expiresIn: '15m' }));
  setCookie(res, 'refresh_token', jwt.sign({ id: user.id, role: 'user' }, process.env.REFRESH_TOKEN_JWT_SECRET!, { expiresIn: '7d' }));
  res.clearCookie('seller_access_token'); res.clearCookie('seller_refresh_token');
  res.redirect(`${process.env.USER_UI_URL || 'http://localhost:3000'}/profile`);
});
