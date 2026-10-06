import express, { Router } from "express";
import {
  createPaymentIntent,
  createPaymentSession,
  getAdminOrders,
  getOrderById,
  getSellerOrders,
  getUserOrders,
  verifyConponCode,
  verifyPaymentSession,
} from "./order.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import { isAdmin, isSeller, isUser } from "@packages/middleware/authorizeRoles";
import { cancelOrder, sellerOrderStatus } from './order-management.controller';
import { getSellerPayments } from './seller-payments.controller';

const router: Router = express.Router();
router.post('/cancel-order/:orderId', isAuthenticated, isUser, cancelOrder);

router.post("/create-payment-intent", isAuthenticated, createPaymentIntent);
router.post("/create-payment-session", isAuthenticated, createPaymentSession);
router.get("/verify-payment-session", isAuthenticated, verifyPaymentSession);
router.get("/get-user-orders", isAuthenticated, getUserOrders);
router.get("/get-order/:orderId", isAuthenticated, getOrderById);
router.get("/get-seller-orders", isAuthenticated, isSeller, getSellerOrders);
router.get("/seller-payments", isAuthenticated, isSeller, getSellerPayments);
router.get("/get-admin-orders", isAuthenticated, isAdmin, getAdminOrders);
router.patch(
  "/update-order-status/:orderId",
  isAuthenticated,
  isSeller,
  sellerOrderStatus,
);
router.post("/verify-coupon", isAuthenticated, verifyConponCode);

export default router;
