import express, { Router } from "express";
import {
  createShop,
  createStripeConnectLink,
  getSeller,
  getUser,
  loginSeller,
  loginUser,
  refreshUserToken,
  refreshSellerToken,
  registerSeller,
  resetUserPassword,
  userForgotPassword,
  userRegistration,
  verifySeller,
  verifyUser,
  verifyUserForgotPassword,
  addUserAddress,
  deleteUserAddress,
  getUserAddress,
} from "../controllers/auth.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import { isSeller } from "@packages/middleware/authorizeRoles";
const router: Router = express.Router();

// User routes
router.post("/user-registration", userRegistration);
router.post("/verify-user", verifyUser);
router.post("/login-user", loginUser);
router.post("/refresh-token", refreshUserToken);
router.post("/seller-refresh-token", refreshSellerToken);
router.get("/logged-in-user", isAuthenticated, getUser);
router.post("/forgot-password-user", userForgotPassword);
router.post("/reset-password-user", resetUserPassword);
router.post("/verify-forgot-password-user", verifyUserForgotPassword);

// Seller routes
router.post("/seller-registration", registerSeller);
router.post("/verify-seller", verifySeller);
router.post("/login-seller", loginSeller);
router.get("/logged-in-seller", isAuthenticated, isSeller, getSeller);
// Shop routes
router.post("/create-shop", createShop);

// Stripe routes
router.post("/create-stripe-link", createStripeConnectLink);

// Address routes
router.get("/shipping-addresses", isAuthenticated, getUserAddress);
router.post("/add-address", isAuthenticated, addUserAddress);
router.delete("/delete-address/:addressId", isAuthenticated, deleteUserAddress);

export default router;
