import express, { Router } from "express";
import {
  createPaymentIntent,
  createPaymentSession,
  getSellerOrders,
  verifyPaymentSession,
} from "./order.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import { isSeller } from "@packages/middleware/authorizeRoles";

const router: Router = express.Router();

router.post("/create-payment-intent", isAuthenticated, createPaymentIntent);
router.post("/create-payment-session", isAuthenticated, createPaymentSession);
router.get("/verify-payment-session", isAuthenticated, verifyPaymentSession);
router.get("/get-seller-orders", isAuthenticated, isSeller, getSellerOrders);

export default router;
