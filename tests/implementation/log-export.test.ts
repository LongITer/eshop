import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, userId } from './helpers';
import { logs } from '../../apps/admin-service/src/controllers/operations.controller';
beforeEach(resetDb);
const records = Array.from({ length: 1001 }, (_, i) => ({ id: String(i).padStart(24, '0'), eventId: `event-${i}`, action: 'productView', userId, source: 'test', type: 'info', message: i === 1000 ? '=SUM(A1:A2)' : `row-${i}`, metadata: { index: i }, createdAt: new Date('2026-10-04T12:00:00Z') }));
test.each(['json', 'csv'])('log %s export includes records beyond a cursor batch', async format => {
  db.behaviorLog.findMany.mockResolvedValueOnce(records.slice(0, 1000)).mockResolvedValueOnce(records.slice(1000));
  const response = await request(appFor('get', '/', logs, 'admin')).get('/?format=' + format + '&action=productView');
  expect(response.status).toBe(200); expect(response.headers['x-export-truncated']).toBe('false');
  expect(db.behaviorLog.findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: records[999].id }, skip: 1, where: { action: 'productView' } });
  if (format === 'json') { expect(response.body).toHaveLength(1001); expect(response.body[1000].metadata.index).toBe(1000); }
  else { expect(response.text).toContain("'=SUM(A1:A2)"); expect(response.text.match(/eventId/g)).toHaveLength(1); expect(response.text).toContain('event-1000'); }
});
test('empty JSON export is a valid empty array', async () => {
  db.behaviorLog.findMany.mockResolvedValue([]);
  const response = await request(appFor('get', '/', logs, 'admin')).get('/?format=json');
  expect(response.status).toBe(200); expect(response.body).toEqual([]);
});
