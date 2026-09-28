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
import isAuthenticated from "@packages/middleware/isAuthenticated";
import { isSeller } from "@packages/middleware/authorizeRoles";

const router: Router = express.Router();

router.get("/get-categories", getCategories);
// Discount
router.get("/get-discount-code", isAuthenticated, isSeller, getDiscountCodes);
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
