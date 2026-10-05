const methods = ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findMany', 'create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert', 'count', 'aggregate', 'groupBy'];
const names = ['users', 'sellers', 'shops', 'address', 'notifications', 'products', 'productReviews', 'inventoryHistory', 'orderItems', 'orders', 'discountCodes', 'productAnalytics', 'userAnalytics', 'behaviorLog', 'site_config', 'oauthIdentity', 'paymentReceipt', 'paymentSession', 'participant', 'conversationGroup', 'chatAttachment', 'pushSubscription', 'message'];
const db: any = {};
for (const name of names) db[name] = Object.fromEntries(methods.map(method => [method, jest.fn()]));
db.$transaction = jest.fn(async (fn: any) => typeof fn === 'function' ? fn(db) : Promise.all(fn));
export function resetDb() { for (const name of names) for (const method of methods) db[name][method].mockReset(); db.$transaction.mockImplementation(async (fn: any) => typeof fn === 'function' ? fn(db) : Promise.all(fn)); }
export default db;
