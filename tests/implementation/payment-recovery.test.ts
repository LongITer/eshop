import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { stripe } from './mocks/stripe';
import { appFor, userId, otherId } from './helpers';
import { paymentResult } from '../../apps/order-service/src/routes/returns.controller';
const app = appFor('get', '/', paymentResult);
beforeEach(() => { resetDb(); stripe.paymentIntents.retrieve.mockReset(); db.paymentSession.findUnique.mockResolvedValue({ id: 'session', userId, payload: { paymentIntentId: 'pi_check', totalAmount: 10, currency: 'usd', cart: [] } }); });
test('cannot substitute a payment from a different account', async () => {
  stripe.paymentIntents.retrieve.mockResolvedValue({ metadata: { sessionId: 'session', userId: otherId }, status: 'succeeded' });
  expect((await request(app).get('/?sessionId=session')).status).toBe(403);
  expect(db.paymentReceipt.create).not.toHaveBeenCalled();
});
test('paid mismatched amount requests review instead of confirming an order', async () => {
  stripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_check', metadata: { sessionId: 'session', userId }, status: 'succeeded', amount_received: 1, currency: 'usd' });
  const response = await request(app).get('/?sessionId=session');
  expect(response.body).toMatchObject({ complete: false, status: 'needs_review' });
  expect(db.paymentReceipt.create).not.toHaveBeenCalled();
});
test.each(['requires_payment_method', 'canceled', 'processing'])('reports Stripe status %s without fulfillment', async status => {
  stripe.paymentIntents.retrieve.mockResolvedValue({ metadata: { sessionId: 'session', userId }, status });
  expect((await request(app).get('/?sessionId=session')).body).toMatchObject({ complete: false, status });
  expect(db.paymentReceipt.create).not.toHaveBeenCalled();
});
