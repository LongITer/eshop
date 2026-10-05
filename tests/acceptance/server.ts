import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '@packages/libs/prisma';
import { errorMiddleware } from '@packages/error-handler/error-middleware';
import auth from '../../apps/auth-service/src/routes/auth.router';
import product from '../../apps/product-service/src/routes/product.router';
import admin from '../../apps/admin-service/src/routes/admin.route';
import order from '../../apps/order-service/src/routes/order.route';
import * as recommendations from '../../apps/recommendation-service/src/controllers/recommendation.controller';
import isAuthenticated from '@packages/middleware/isAuthenticated';
import { isUser } from '@packages/middleware/authorizeRoles';
import { handle } from '@packages/utils/api';

export async function start() {
  const password = await bcrypt.hash('Acceptance123!', 4);
  const buyer = await prisma.users.create({ data: { name: 'Acceptance Buyer', email: 'buyer@example.test', password, following: [] } });
  const administrator = await prisma.users.create({ data: { name: 'Acceptance Admin', email: 'admin@example.test', password, role: 'admin', following: [] } });
  const seller = await prisma.sellers.create({ data: { name: 'Acceptance Seller', email: 'seller@example.test', password, phone_number: '0123456789', country: 'Vietnam' } });
  const shop = await prisma.shops.create({ data: { name: 'Saigon PC Store', sellerId: seller.id, category: 'PC Components', bio: 'Components for your next PC build.', opening_hours: '09:00–18:00', address: 'Ho Chi Minh City' } });
  const image = 'https://hunggiaco.com/wp-content/uploads/2026/03/avatar-mac-dinh-facebook-1-1.jpg';
  const cpu = await prisma.products.create({ data: { title: 'Ryzen Gaming CPU', slug: 'acceptance-cpu', category: 'PC Components', subCategory: 'CPU', short_description: 'A fast processor for daily work and gaming.', detailed_description: 'Six cores for your next desktop build.', tags: ['gaming'], colors: ['Black'], sizes: [], stock: 3, sale_price: 80, regular_price: 100, warranty: '24 months', shopId: shop.id, discount_codes: [], images: { create: { url: image, file_id: 'acceptance-image' } } } });
  await prisma.site_config.create({ data: { categories: ['PC Components'], subCategories: { 'PC Components': ['CPU', 'GPU', 'Memory'] } } });
  const address = await prisma.address.create({ data: { userId: buyer.id, name: buyer.name, label: 'Home', street: '12 Nguyen Hue', city: 'Ho Chi Minh City', zip: '70000', country: 'Vietnam', isDefault: true } });
  const orders: any[] = [];
  for (const [i, status] of ['Pending', 'Delivered', 'Shipped', 'Cancelled'].entries()) {
    orders.push(await prisma.orders.create({ data: { orderNumber: `ACCEPTANCE-${i + 1}`, userId: buyer.id, shopId: shop.id, status: status as any, paymentStatus: 'Paid', stripePaymentId: 'pi_acceptance', subTotal: 80, totalAmount: 80, shippingAddress: { name: buyer.name, street: address.street, city: address.city, country: address.country }, trackingNumber: status === 'Shipped' ? 'TRACK12345' : null, estimatedDelivery: status === 'Shipped' ? new Date(Date.now() + 2 * 86400000) : null, createdAt: new Date(Date.now() - i * 86400000), items: { create: { productId: cpu.id, title: cpu.title, quantity: 1, unitPrice: 80, totalPrice: 80 } } } }));
  }
  await prisma.notifications.createMany({ data: [{ userId: buyer.id, type: 'OrderShipped', title: 'Your order is on the way', message: 'Track your package for the latest updates.', redirectUrl: `/order/${orders[2].id}` }, { sellerId: seller.id, type: 'LowStock', title: 'Low stock', message: 'Ryzen Gaming CPU has 3 units remaining.', redirectUrl: '/dashboard/inventory' }, { type: 'System', title: 'Platform order alert', message: 'New order from Saigon PC Store.' }] });
  await prisma.behaviorLog.createMany({ data: ['productView', 'addToCart', 'paymentSuccess'].map((action, i) => ({ eventId: `acceptance-${i}`, action, userId: buyer.id, source: 'acceptance', type: 'info', message: `Example ${action}`, metadata: { productId: cpu.id } })) });
  await prisma.productAnalytics.create({ data: { productId: cpu.id, shopId: shop.id, views: 20, cartAdds: 4, purchases: 3, lastViewedAt: new Date() } });
  const app = express(); app.use(express.json({ limit: '8mb' })); app.use(cookieParser());
  app.get('/api/acceptance/session/:role', (req, res) => {
    const role = req.params.role; const actor = role === 'seller' ? seller : role === 'admin' ? administrator : buyer;
    res.clearCookie('access_token'); res.clearCookie('seller_access_token');
    res.cookie(role === 'seller' ? 'seller_access_token' : 'access_token', jwt.sign({ id: actor.id, role }, process.env.ACCESS_TOKEN_JWT_SECRET!, { expiresIn: '2h' }), { httpOnly: true, sameSite: 'lax' });
    res.redirect(role === 'user' ? '/profile' : '/dashboard');
  });
  app.get('/api/acceptance/fixture', (_req, res) => { res.json({ productId: cpu.id, shopId: shop.id, orders: orders.map(o => ({ id: o.id, status: o.status })), buyerId: buyer.id }); });
  app.get('/chatting/api/unread-count', isAuthenticated, (_req, res) => { res.json({ unreadCount: 0 }); });
  app.use('/api', auth); app.use('/product/api', product); app.use('/admin', admin); app.use('/order/api', order); app.use('/order', order);
  app.get('/recommendation/api/trending-products', recommendations.trending);
  app.get('/recommendation/api/similar-products/:productId', recommendations.similar);
  app.get('/recommendation/api/recommendations/:userId', isAuthenticated, isUser, recommendations.personalized);
  app.get('/gateway-health', handle(async (_req, res) => { res.json({ fixture: true }); }));
  app.use(errorMiddleware);
  const server = app.listen(8080, '127.0.0.1', () => console.log('ACCEPTANCE_READY http://localhost:8080 (isolated MongoDB; Stripe/Redis/logging doubles)'));
  return { server, prisma };
}
