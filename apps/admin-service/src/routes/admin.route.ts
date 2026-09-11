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
import isAuthenticated from "@packages/middleware/isAuthenticated";
import { isAdmin } from "@packages/middleware/authorizeRoles";

const router: Router = express.Router();

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

// Users
// GET /admin/get-all-users?page=1&limit=20&search=...
router.get("/get-all-users", isAuthenticated, isAdmin, getAllUsers);

// Sellers
// GET /admin/get-all-sellers?page=1&limit=20&search=...
router.get("/get-all-sellers", isAuthenticated, isAdmin, getAllSellers);

export default router;