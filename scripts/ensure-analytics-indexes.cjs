// Additive only. No database/schema reset and no existing index removal.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function main() {
  await db.$runCommandRaw({ createIndexes: 'orderItems', indexes: [
    { key: { orderId: 1 }, name: 'orderItems_orderId_idx' },
    { key: { productId: 1, orderId: 1 }, name: 'orderItems_productId_orderId_idx' },
  ] });
  await db.$runCommandRaw({ createIndexes: 'orders', indexes: [
    { key: { shopId: 1, userId: 1, createdAt: 1 }, name: 'orders_shopId_userId_createdAt_idx' },
  ] });
  console.log('Analytics lookup and scoped customer-history indexes are ready.');
}
main().catch(() => { console.error('Could not prepare analytics indexes. No application data was changed.'); process.exitCode = 1; }).finally(() => db.$disconnect());
