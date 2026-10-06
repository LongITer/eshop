import express, { Router } from "express";
import {
  createShop,
  createStripeConnectLink,
  changeUserPassword,
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
  deleteUserAddress,
  getUserAddress,
  loginAdmin,
  getAdmin,
} from "../controllers/auth.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import { isAdmin, isSeller, isUser } from "@packages/middleware/authorizeRoles";
import * as account from '../controllers/account.controller';
import { googleStart, googleCallback } from '../controllers/google.controller';
const router: Router = express.Router();
router.get('/auth/google', googleStart);
router.get('/auth/google/callback', googleCallback);
router.get('/user-notifications', isAuthenticated, isUser, account.getNotifications);
router.patch('/notifications/read-all', isAuthenticated, isUser, account.readAllNotifications);
router.patch('/notifications/:id/read', isAuthenticated, isUser, account.readNotification);
router.put('/update-address/:addressId', isAuthenticated, isUser, account.updateAddress);
router.put('/update-user', isAuthenticated, isUser, account.updateUser);
router.post('/upload-account-image', isAuthenticated, account.uploadAccountImage);
router.put('/update-shop/:shopId', isAuthenticated, isSeller, account.updateShop);
router.post('/follow-shop/:shopId', isAuthenticated, isUser, account.followShop);
router.delete('/unfollow-shop/:shopId', isAuthenticated, isUser, account.unfollowShop);
router.get('/followed-shops', isAuthenticated, isUser, account.followedShops);

// User routes
router.post("/user-registration", userRegistration);
router.post("/verify-user", verifyUser);
router.post("/login-user", loginUser);
router.get('/logout-user', (_req, res) => {
  for (const name of ['access_token', 'refresh_token']) res.clearCookie(name, { path: '/' });
  res.json({ success: true });
});
router.post("/login-admin", loginAdmin);
router.post("/refresh-token", refreshUserToken);
router.post("/seller-refresh-token", refreshSellerToken);
router.get("/logged-in-user", isAuthenticated, isUser, getUser);
router.get("/logged-in-admin", isAuthenticated, isAdmin, getAdmin);
router.patch("/change-password", isAuthenticated, changeUserPassword);
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
router.get("/shipping-addresses", isAuthenticated, isUser, getUserAddress);
router.post("/add-address", isAuthenticated, isUser, account.addAddress);
router.delete("/delete-address/:addressId", isAuthenticated, isUser, deleteUserAddress);

export default router;
