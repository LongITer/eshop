import express, { Router } from "express";
import { getAllProducts } from "../controllers/admin.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import { isAdmin } from "@packages/middleware/authorizeRoles";

const router: Router = express.Router();

// GET /admin/get-all-products?page=1&limit=20&search=...
router.get("/get-all-products", isAuthenticated, isAdmin, getAllProducts);

export default router;