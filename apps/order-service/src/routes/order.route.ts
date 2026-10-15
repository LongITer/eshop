import { adminPermission } from '@packages/middleware/adminPermission';
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
import * as customer from './customer-tools.controller';
import { uploadEvidence, escalateReturn } from './return-evidence.controller';

const router: Router = express.Router();
router.post('/return-evidence/:orderId', isAuthenticated, isUser, uploadEvidence);
router.post('/escalate-return/:orderId', isAuthenticated, isUser, escalateReturn);
router.post('/inspect-cart', customer.inspectCart);
router.get('/my-orders', isAuthenticated, isUser, customer.customerOrders);
router.get('/my-order-stats', isAuthenticated, isUser, customer.orderStats);
router.get('/reorder/:orderId', isAuthenticated, isUser, customer.reorder);
import { requestReturn, orderAftercare, reviewReturn, paymentResult } from './returns.controller';
router.get('/payment-result', isAuthenticated, isUser, paymentResult);
router.get('/aftercare/:orderId', isAuthenticated, isUser, orderAftercare);
router.get('/seller-aftercare/:orderId', isAuthenticated, isSeller, orderAftercare);
router.post('/returns/:orderId', isAuthenticated, isUser, requestReturn);
router.patch('/returns/:orderId', isAuthenticated, isSeller, reviewReturn);
router.post('/cancel-order/:orderId', isAuthenticated, isUser, cancelOrder);

router.post("/create-payment-intent", isAuthenticated, isUser, createPaymentIntent);
router.post("/create-payment-session", isAuthenticated, isUser, createPaymentSession);
router.get("/verify-payment-session", isAuthenticated, isUser, verifyPaymentSession);
router.get("/get-user-orders", isAuthenticated, isUser, getUserOrders);
router.get("/get-order/:orderId", isAuthenticated, isUser, getOrderById);
router.get("/get-seller-orders", isAuthenticated, isSeller, getSellerOrders);
router.get("/seller-payments", isAuthenticated, isSeller, getSellerPayments);
router.get("/get-admin-orders", isAuthenticated, isAdmin, adminPermission('orders'), getAdminOrders);
router.patch(
  "/update-order-status/:orderId",
  isAuthenticated,
  isSeller,
  sellerOrderStatus,
);
router.post("/verify-coupon", isAuthenticated, isUser, verifyConponCode);

export default router;
