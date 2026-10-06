import express, { Router } from "express";
import {
  createDiscountCode,
  createProduct,
  deleteDiscountCodes,
  deleteProductImages,
  getCategories,
  getDiscountCodes,
  getShopProducts,
  restoreProduct,
  uploadProductImages,
  deleteProduct,
  getAllProducts,
  getProductDetails,
  getFilteredProducts,
  getFilteredShops,
  getShopById,
  searchProducts,
  getFilteredEvents,
  topShops,
  getAllEvents,
} from "../controllers/product.controller";
import {
  getSellerNotifications,
  markAllSellerNotificationsRead,
  markSellerNotificationRead,
} from "../controllers/seller-notification.controller";
import { getSellerStats } from "../controllers/seller-stats.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import { isSeller, isUser } from "@packages/middleware/authorizeRoles";
import * as management from '../controllers/product-management.controller';
import { revenueReport } from '../controllers/reports.controller';
import prisma from '@packages/libs/prisma';
import { handle } from '@packages/utils/api';

const router: Router = express.Router();
router.get('/sitemap-data', handle(async (req, res) => {
  const skip = Math.max(0, Math.floor(Number(req.query.page) || 0)) * 500;
  const [products, shops] = await Promise.all([
    prisma.products.findMany({ where: { isDeleted: false, status: 'Active' }, orderBy: { id: 'asc' }, skip, take: 500, select: { slug: true, updatedAt: true } }),
    prisma.shops.findMany({ orderBy: { id: 'asc' }, skip, take: 500, select: { id: true, updatedAt: true } }),
  ]);
  res.json({ entries: [...products.map(p => ({ path: `/product/${encodeURIComponent(p.slug)}`, updatedAt: p.updatedAt })), ...shops.map(s => ({ path: `/shop/${s.id}`, updatedAt: s.updatedAt }))], hasMore: products.length === 500 || shops.length === 500 });
}));
router.get('/seller-reports', isAuthenticated, isSeller, revenueReport);
router.get('/seller-product/:id', isAuthenticated, isSeller, management.getEditableProduct);
router.put('/update-product/:id', isAuthenticated, isSeller, management.updateProduct);
router.get('/inventory', isAuthenticated, isSeller, management.getInventory);
router.post('/create-review', isAuthenticated, isUser, management.createReview);
router.get('/product-reviews/:productId', management.getReviews);

router.get("/get-categories", getCategories);
router.get("/get-seller-stats", isAuthenticated, isSeller, getSellerStats);
// Discount
router.get("/get-discount-code", isAuthenticated, isSeller, getDiscountCodes);
router.get(
  "/get-seller-notifications",
  isAuthenticated,
  isSeller,
  getSellerNotifications,
);
router.patch(
  "/notifications/read-all",
  isAuthenticated,
  isSeller,
  markAllSellerNotificationsRead,
);
router.patch(
  "/notifications/:id/read",
  isAuthenticated,
  isSeller,
  markSellerNotificationRead,
);
router.post("/create-discount-code", isAuthenticated, isSeller, createDiscountCode);
router.delete(
  "/delete-discount-code/:id",
  isAuthenticated,
  isSeller,
  deleteDiscountCodes,
);
router.post("/upload-product-image", isAuthenticated, isSeller, uploadProductImages);
router.delete("/delete-product-image", isAuthenticated, isSeller, deleteProductImages);
// Products
router.post("/create-product", isAuthenticated, isSeller, createProduct);
router.get("/get-shop-products", isAuthenticated, isSeller, getShopProducts);
router.post("/delete-product/:id", isAuthenticated, isSeller, deleteProduct);
router.post("/restore-product/:id", isAuthenticated, isSeller, restoreProduct);
// All products
router.get("/get-all-products", getAllProducts);
// Find product by slug
router.get("/get-product/:slug", getProductDetails);
//
router.get("/get-filtered-products", getFilteredProducts);
router.get("/get-filtered-offers", getFilteredEvents);
router.get("/get-filtered-shops", getFilteredShops);
router.get("/search-products", searchProducts);
router.get("/top-shops", topShops);
router.get("/get-shop/:id", getShopById);
router.get("/get-all-events", getAllEvents);

export default router;
