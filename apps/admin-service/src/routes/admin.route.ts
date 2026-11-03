import * as jobs from '../controllers/notification-jobs.controller';
import * as templates from '../controllers/templates.controller';
import express, { Router } from "express";
import {
  getAllProducts,
  getAllEvents,
  getAllAdmin,
  addAdmin,
  getSiteConfig,
  updateSiteConfig,
  getAllUsers,
  getAllSellers,
} from "../controllers/admin.controller";
import {
  getLogConfig,
  updateLogConfig,
} from "../controllers/log-config.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import { isAdmin } from "@packages/middleware/authorizeRoles";
import { adminPermission } from '@packages/middleware/adminPermission';
import * as gov from '../controllers/governance.controller';
import * as ops from '../controllers/operations.controller';
import { adminStatistics } from '../controllers/statistics.controller';
import * as moderation from '../controllers/product-reports.controller';
import rateLimit from 'express-rate-limit';

const router: Router = express.Router();
router.get('/product-reports', isAuthenticated, isAdmin, adminPermission('catalog'), moderation.reports);
router.post('/product-reports', isAuthenticated, isAdmin, adminPermission('catalog'), moderation.adminReport);
router.patch('/product-reports/:id', isAuthenticated, isAdmin, adminPermission('catalog'), moderation.reviewReport);
router.get('/violations', isAuthenticated, isAdmin, adminPermission('catalog'), moderation.violations);
router.post('/products/:id/scan', isAuthenticated, isAdmin, adminPermission('catalog'), rateLimit({ windowMs: 60000, max: 10, keyGenerator: req => req.user!.id }), moderation.scanListing);
router.get('/statistics', isAuthenticated, isAdmin, adminPermission('overview'), adminStatistics);
router.get('/orders', isAuthenticated, isAdmin, adminPermission('orders'), ops.getOrders);
router.get('/orders/:orderId', isAuthenticated, isAdmin, adminPermission('orders'), ops.orderDetail);
router.patch('/update-order-status/:orderId', isAuthenticated, isAdmin, adminPermission('fulfillment'), ops.updateStatus);
router.get('/dashboard-stats', isAuthenticated, isAdmin, adminPermission('overview'), ops.dashboard);
router.get('/notifications', isAuthenticated, isAdmin, adminPermission('notifications'), ops.notifications);
router.post('/send-notification', isAuthenticated, isAdmin, adminPermission('notifications'), jobs.queueNotification);
router.get('/payments', isAuthenticated, isAdmin, adminPermission('payments'), ops.payments);
router.post('/refund/:paymentId', isAuthenticated, isAdmin, adminPermission('payments'), ops.refund);
router.get('/logs', isAuthenticated, isAdmin, adminPermission('logs'), ops.logs);

// Products
// GET /admin/get-all-products?page=1&limit=20&search=...
router.get("/get-all-products", isAuthenticated, isAdmin, adminPermission('catalog'), getAllProducts);

// Events
// GET /admin/get-all-events?page=1&limit=20&search=...
router.get("/get-all-events", isAuthenticated, isAdmin, adminPermission('catalog'), getAllEvents);

// Admins
// GET  /admin/get-all-admins
router.get("/get-all-admins", isAuthenticated, isAdmin, adminPermission('team'), getAllAdmin);
// POST /admin/add-admin  { email }
router.post("/add-admin", isAuthenticated, isAdmin, adminPermission('team'), addAdmin);

// Site config (customizations)
// GET   /admin/get-site-config
router.get("/get-site-config", isAuthenticated, isAdmin, adminPermission('settings'), getSiteConfig);
// PATCH /admin/update-site-config
router.patch("/update-site-config", isAuthenticated, isAdmin, adminPermission('settings'), updateSiteConfig);

// Log config (user behavior logging settings)
// GET   /admin/log-config
router.get("/log-config", isAuthenticated, isAdmin, adminPermission('settings'), getLogConfig);
// PATCH /admin/update-log-config
router.patch("/update-log-config", isAuthenticated, isAdmin, adminPermission('settings'), updateLogConfig);

// Users
// GET /admin/get-all-users?page=1&limit=20&search=...
router.get("/get-all-users", isAuthenticated, isAdmin, adminPermission('accounts'), getAllUsers);

// Sellers
// GET /admin/get-all-sellers?page=1&limit=20&search=...
router.get("/get-all-sellers", isAuthenticated, isAdmin, adminPermission('accounts'), getAllSellers);

router.patch('/accounts/:kind/:id', isAuthenticated, isAdmin, adminPermission('accounts'), gov.suspendAccount);
router.patch('/products/:id/moderation', isAuthenticated, isAdmin, adminPermission('catalog'), gov.moderateProduct);
router.get('/audit', isAuthenticated, isAdmin, adminPermission('team'), gov.auditLog);
router.get('/returns', isAuthenticated, isAdmin, adminPermission('returns'), gov.returns);
router.patch('/returns/:orderId', isAuthenticated, isAdmin, adminPermission('returns'), gov.reviewReturn);
router.get('/work-queue', isAuthenticated, isAdmin, gov.workQueue);
router.get('/lookup', isAuthenticated, isAdmin, gov.lookup);
router.post('/site-image', isAuthenticated, isAdmin, adminPermission('settings'), gov.uploadImage);
router.get('/notification-jobs', isAuthenticated, isAdmin, adminPermission('notifications'), jobs.notificationJobs);
router.post('/notification-jobs/:id/retry', isAuthenticated, isAdmin, adminPermission('notifications'), jobs.retryNotification);
router.get('/templates', isAuthenticated, isAdmin, adminPermission('catalog'), templates.templates);
router.post('/templates', isAuthenticated, isAdmin, adminPermission('catalog'), templates.saveTemplate);
router.put('/templates/:id', isAuthenticated, isAdmin, adminPermission('catalog'), templates.saveTemplate);
export default router;
