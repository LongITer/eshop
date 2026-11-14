// Add only the new moderation collections/indexes. Never drops or rewrites existing data/indexes.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function main() {
  const definitions = {
    productReport: [
      { key: { dedupeKey: 1 }, name: 'productReport_dedupeKey_key', unique: true },
      { key: { status: 1, createdAt: 1 }, name: 'productReport_status_createdAt_idx' },
      { key: { productId: 1, createdAt: 1 }, name: 'productReport_productId_createdAt_idx' },
    ],
    productViolation: [
      { key: { sellerId: 1, createdAt: 1 }, name: 'productViolation_sellerId_createdAt_idx' },
      { key: { followupStatus: 1, createdAt: 1 }, name: 'productViolation_followupStatus_createdAt_idx' },
    ],
    moderationOrderTask: [
      { key: { violationId: 1, orderId: 1 }, name: 'moderationOrderTask_violationId_orderId_key', unique: true },
      { key: { shopId: 1, status: 1, createdAt: 1 }, name: 'moderationOrderTask_shopId_status_createdAt_idx' },
    ],
  };
  for (const [collection, indexes] of Object.entries(definitions)) {
    await db.$runCommandRaw({ createIndexes: collection, indexes });
    console.log(`Ready: ${collection}`);
  }
}
main().catch(() => { console.error('Could not prepare moderation indexes; existing application data is unchanged.'); process.exitCode = 1; }).finally(() => db.$disconnect());
