import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, otherId, userId } from './helpers';
import { imageKit } from '@packages/libs/imagekit';
import { evidenceImage, uploadEvidence } from '../../apps/order-service/src/routes/return-evidence.controller';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const app = appFor('post', '/:orderId', uploadEvidence);
beforeEach(() => { resetDb(); (imageKit.upload as jest.Mock).mockReset(); db.orders.findFirst.mockResolvedValue({ id: otherId, userId }); });

test('valid PNG is uploaded only for the buyer and returns an HTTPS URL', async () => {
  (imageKit.upload as jest.Mock).mockResolvedValue({ url: 'https://ik.imagekit.io/test/evidence.png' });
  const response = await request(app).post('/' + otherId).send({ file: png });
  expect(response.status).toBe(201);
  expect(response.body.url).toBe('https://ik.imagekit.io/test/evidence.png');
  expect(db.orders.findFirst).toHaveBeenCalledWith({ where: { id: otherId, userId, status: 'Delivered', paymentStatus: 'Paid' } });
  expect(imageKit.upload).toHaveBeenCalledWith(expect.objectContaining({ folder: '/returns/' + otherId, fileName: expect.stringMatching(/\.png$/) }));
});

test('rejects MIME mismatch, malformed base64 and oversized input before provider call', () => {
  expect(() => evidenceImage(png.replace('image/png', 'image/jpeg'))).toThrow('Image format does not match');
  expect(() => evidenceImage(png + '=')).toThrow();
  expect(() => evidenceImage('data:image/png;base64,' + 'A'.repeat(7_000_000))).toThrow('5 MB');
  expect(imageKit.upload).not.toHaveBeenCalled();
});

test('does not upload more evidence after the return has been submitted', async () => {
  db.returnRequest.findUnique.mockResolvedValue({ orderId: otherId, status: 'Requested' });
  expect((await request(app).post('/' + otherId).send({ file: png })).status).toBe(400);
  expect(imageKit.upload).not.toHaveBeenCalled();
});

test.each(['provider failure', 'unsafe response'])('provider %s remains retryable without exposing internal details', async scenario => {
  if (scenario === 'provider failure') (imageKit.upload as jest.Mock).mockRejectedValue(new Error('provider-secret-detail'));
  else (imageKit.upload as jest.Mock).mockResolvedValue({ url: 'javascript:alert(1)' });
  const response = await request(app).post('/' + otherId).send({ file: png });
  expect(response.status).toBe(503);
  expect(response.body.message).toMatch(/retry the remaining files/);
  expect(JSON.stringify(response.body)).not.toMatch(/provider-secret-detail|javascript:/);
  (imageKit.upload as jest.Mock).mockResolvedValue({ url: 'https://ik.imagekit.io/test/retry.png' });
  expect((await request(app).post('/' + otherId).send({ file: png })).status).toBe(201);
});
