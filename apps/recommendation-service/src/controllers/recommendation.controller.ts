import prisma from '@packages/libs/prisma';
import { handle, objectId } from '@packages/utils/api';
import { ForbiddenError, NotFoundError } from '@packages/error-handler';
import { similarity, popularity, actionWeight } from '../services/scoring';

async function candidates() {
  const [products, analytics] = await Promise.all([
    prisma.products.findMany({ where: { isDeleted: false, status: 'Active', stock: { gt: 0 } }, include: { images: true, shop: { select: { id: true, name: true, avatar: true, ratings: true } } }, orderBy: { updatedAt: 'desc' }, take: 1000 }),
    prisma.productAnalytics.findMany({ orderBy: { lastViewedAt: 'desc' }, take: 5000 }),
  ]);
  const scores = new Map(analytics.map(a => [a.productId, popularity(a)]));
  return { products, scores };
}
function limit(value: unknown) { return Math.min(50, Math.max(1, Math.floor(Number(value) || 12))); }
export const trending = handle(async (req, res) => {
  const { products, scores } = await candidates();
  products.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
  res.json({ products: products.slice(0, limit(req.query.limit)), strategy: 'engagement-recency' });
});
export const similar = handle(async (req, res) => {
  const product = await prisma.products.findFirst({ where: { id: objectId(req.params.productId), isDeleted: false, status: 'Active' } });
  if (!product) throw new NotFoundError();
  const { products, scores } = await candidates();
  const ranked = products.filter(p => p.id !== product.id).map(p => ({ product: p, score: similarity(product, p) + (scores.get(p.id) ?? 0) * 0.1 })).sort((a, b) => b.score - a.score);
  res.json({ products: ranked.slice(0, limit(req.query.limit)).map(p => p.product), strategy: 'content-based' });
});
export const personalized = handle(async (req, res) => {
  const userId = objectId(req.params.userId);
  if (userId !== req.user.id) throw new ForbiddenError();
  const history = await prisma.userAnalytics.findUnique({ where: { userId } });
  const actions = (history?.actions ?? []).filter((a): a is any => !!a && typeof a === 'object');
  const ids = actions.map((a: any) => a.productId).filter((id: unknown): id is string => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id));
  const [seeds, { products, scores }] = await Promise.all([prisma.products.findMany({ where: { id: { in: ids } } }), candidates()]);
  const weights = new Map<string, number>();
  for (const action of actions) weights.set(action.productId, (weights.get(action.productId) ?? 0) + actionWeight(action.action));
  const ranked = products.map(product => ({ product, score: seeds.reduce((sum, seed) => sum + similarity(seed, product) * Math.min(10, weights.get(seed.id) ?? 0), 0) + (scores.get(product.id) ?? 0) })).sort((a, b) => b.score - a.score);
  res.json({ products: ranked.slice(0, limit(req.query.limit)).map(p => p.product), strategy: seeds.length ? 'content-based-personalized' : 'cold-start-trending' });
});
