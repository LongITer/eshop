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
} from "../controllers/product.controller";
import isAuthenticated from "@packages/middleware/isAuthenticated";

const router: Router = express.Router();

router.get("/get-categories", getCategories);
// Discount
router.get("/get-discount-code", isAuthenticated, getDiscountCodes);
router.post("/create-discount-code", isAuthenticated, createDiscountCode);
router.delete(
  "/delete-discount-code/:id",
  isAuthenticated,
  deleteDiscountCodes,
);
router.post("/upload-product-image", isAuthenticated, uploadProductImages);
router.delete("/delete-product-image", isAuthenticated, deleteProductImages);
// Products
router.post("/create-product", isAuthenticated, createProduct);
router.get("/get-shop-products", isAuthenticated, getShopProducts);
router.post("/delete-product/:id", isAuthenticated, deleteProduct);
router.post("/restore-product/:id", isAuthenticated, restoreProduct);
// All products
router.get("/get-all-products", getAllProducts);
// Find product by slug
router.get("/get-product/:slug", getProductDetails);
export default router;
