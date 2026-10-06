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
import * as ops from '../controllers/operations.controller';

const router: Router = express.Router();
router.get('/orders', isAuthenticated, isAdmin, ops.getOrders);
router.get('/orders/:orderId', isAuthenticated, isAdmin, ops.orderDetail);
router.patch('/update-order-status/:orderId', isAuthenticated, isAdmin, ops.updateStatus);
router.get('/dashboard-stats', isAuthenticated, isAdmin, ops.dashboard);
router.get('/notifications', isAuthenticated, isAdmin, ops.notifications);
router.post('/send-notification', isAuthenticated, isAdmin, ops.sendNotification);
router.get('/payments', isAuthenticated, isAdmin, ops.payments);
router.post('/refund/:paymentId', isAuthenticated, isAdmin, ops.refund);
router.get('/logs', isAuthenticated, isAdmin, ops.logs);

// Products
// GET /admin/get-all-products?page=1&limit=20&search=...
router.get("/get-all-products", isAuthenticated, isAdmin, getAllProducts);

// Events
// GET /admin/get-all-events?page=1&limit=20&search=...
router.get("/get-all-events", isAuthenticated, isAdmin, getAllEvents);

// Admins
// GET  /admin/get-all-admins
router.get("/get-all-admins", isAuthenticated, isAdmin, getAllAdmin);
// POST /admin/add-admin  { email }
router.post("/add-admin", isAuthenticated, isAdmin, addAdmin);

// Site config (customizations)
// GET   /admin/get-site-config
router.get("/get-site-config", isAuthenticated, isAdmin, getSiteConfig);
// PATCH /admin/update-site-config
router.patch("/update-site-config", isAuthenticated, isAdmin, updateSiteConfig);

// Log config (user behavior logging settings)
// GET   /admin/log-config
router.get("/log-config", isAuthenticated, isAdmin, getLogConfig);
// PATCH /admin/update-log-config
router.patch("/update-log-config", isAuthenticated, isAdmin, updateLogConfig);

// Users
// GET /admin/get-all-users?page=1&limit=20&search=...
router.get("/get-all-users", isAuthenticated, isAdmin, getAllUsers);

// Sellers
// GET /admin/get-all-sellers?page=1&limit=20&search=...
router.get("/get-all-sellers", isAuthenticated, isAdmin, getAllSellers);

export default router;
