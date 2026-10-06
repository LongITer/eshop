import express from 'express';
import { errorMiddleware } from '@packages/error-handler/error-middleware';
export const userId = '111111111111111111111111';
export const otherId = '222222222222222222222222';
export const productId = '333333333333333333333333';
export const shopId = '444444444444444444444444';
export function appFor(method: string, route: string, handler: any, role = 'user') {
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => { req.user = { id: userId, role }; req.seller = { id: userId, shop: { id: shopId } }; req.role = role; next(); });
  (app as any)[method](route, handler); app.use(errorMiddleware); return app;
}
