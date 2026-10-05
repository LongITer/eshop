import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import isAuthenticated from '@packages/middleware/isAuthenticated';
import { isAdmin, isSeller } from '@packages/middleware/authorizeRoles';
import { errorMiddleware } from '@packages/error-handler/error-middleware';
import db, { resetDb } from './mocks/prisma';
import { userId } from './helpers';
import authRouter from '../../apps/auth-service/src/routes/auth.router';
import bcrypt from 'bcryptjs';
beforeEach(resetDb);
const app = express(); app.use(cookieParser()); app.get('/admin', isAuthenticated, isAdmin, (_req, res) => { res.json({ ok: true }); }); app.get('/seller', isAuthenticated, isSeller, (_req, res) => { res.json({ ok: true }); }); app.use(errorMiddleware);
test('missing authentication is rejected before database access', async () => { expect((await request(app).get('/admin')).status).toBe(401); expect(db.users.findUnique).not.toHaveBeenCalled(); });
test('buyer token cannot access admin endpoints', async () => { db.users.findUnique.mockResolvedValue({ id: userId, role: 'user' }); const token = jwt.sign({ id: userId, role: 'user' }, process.env.ACCESS_TOKEN_JWT_SECRET!); expect((await request(app).get('/admin').set('Authorization', `Bearer ${token}`)).status).toBe(401); });
test('invalid token cannot access seller endpoints', async () => { expect((await request(app).get('/seller').set('Authorization', 'Bearer invalid')).status).toBe(401); });
test('seller authentication resolves the seller shop', async () => { db.sellers.findUnique.mockResolvedValue({ id: userId, shop: { id: 'shop' } }); const token = jwt.sign({ id: userId, role: 'seller' }, process.env.ACCESS_TOKEN_JWT_SECRET!); expect((await request(app).get('/seller').set('Authorization', `Bearer ${token}`)).status).toBe(200); expect(db.sellers.findUnique.mock.calls[0][0].include).toEqual({ shop: true }); });

const profileApp = express();
profileApp.use(express.json());
profileApp.use(cookieParser());
profileApp.use('/api', authRouter);
profileApp.use(errorMiddleware);

test('seller cookie cannot reach the buyer profile controller and cause a 500', async () => {
  db.sellers.findUnique.mockResolvedValue({ id: userId, shop: null });
  const token = jwt.sign({ id: userId, role: 'seller' }, process.env.ACCESS_TOKEN_JWT_SECRET!);
  const response = await request(profileApp).get('/api/logged-in-user').set('Cookie', `seller_access_token=${token}`);
  expect(response.status).toBe(401);
  expect(db.users.findUnique).not.toHaveBeenCalled();
});

test('buyer profile returns the name and handles a missing avatar', async () => {
  db.users.findUnique.mockResolvedValue({ id: userId, role: 'user', name: 'Buyer', avatar: [] });
  const token = jwt.sign({ id: userId, role: 'user' }, process.env.ACCESS_TOKEN_JWT_SECRET!);
  const response = await request(profileApp).get('/api/logged-in-user').set('Cookie', `access_token=${token}`);
  expect(response.status).toBe(200);
  expect(response.body.user).toMatchObject({ name: 'Buyer', avatar: null });
});

test('admin account can log in as a customer without gaining admin session permissions', async () => {
  db.users.findUnique.mockResolvedValue({ id: userId, role: 'admin', password: await bcrypt.hash('TestPassword123!', 4) });
  const response = await request(profileApp).post('/api/login-user').send({ email: 'admin@example.test', password: 'TestPassword123!' });
  expect(response.status).toBe(200);
  const cookie = response.headers['set-cookie'].find((value: string) => value.startsWith('access_token='));
  const token = cookie.split(';')[0].slice('access_token='.length);
  expect(jwt.verify(token, process.env.ACCESS_TOKEN_JWT_SECRET!)).toMatchObject({ id: userId, role: 'user' });
  expect((await request(app).get('/admin').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  db.users.findUnique.mockResolvedValue({ id: userId, role: 'admin', name: 'Admin buyer', avatar: [] });
  const profile = await request(profileApp).get('/api/logged-in-user').set('Cookie', cookie.split(';')[0]);
  expect(profile.status).toBe(200);
  expect(profile.body.user.name).toBe('Admin buyer');
});

test('admin account can refresh its customer session', async () => {
  db.users.findUnique.mockResolvedValue({ id: userId, role: 'admin' });
  const token = jwt.sign({ id: userId, role: 'user' }, process.env.REFRESH_TOKEN_JWT_SECRET!);
  const response = await request(profileApp).post('/api/refresh-token').set('Cookie', `refresh_token=${token}`);
  expect(response.status).toBe(201);
  const cookie = response.headers['set-cookie'].find((value: string) => value.startsWith('access_token='));
  expect(jwt.verify(cookie.split(';')[0].slice('access_token='.length), process.env.ACCESS_TOKEN_JWT_SECRET!)).toMatchObject({ role: 'user' });
});

test('revoking admin role still rejects an existing admin session', async () => {
  db.users.findUnique.mockResolvedValue({ id: userId, role: 'user' });
  const token = jwt.sign({ id: userId, role: 'admin' }, process.env.ACCESS_TOKEN_JWT_SECRET!);
  expect((await request(app).get('/admin').set('Authorization', `Bearer ${token}`)).status).toBe(401);
});
