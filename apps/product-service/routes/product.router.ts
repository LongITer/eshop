import express, {Router} from 'express';
import { createDiscountCode, deleteDiscountCodes, getCategories, getDiscountCodes, uploadProductImages } from '../controllers/product.controller';
import isAuthenticated from '@packages/middleware/isAuthenticated';
 

const router:Router = express.Router();


router.get("/get-categories", getCategories);

router.get("/get-discount-code", isAuthenticated, getDiscountCodes);
router.post("/create-discount-code", isAuthenticated, createDiscountCode);
router.delete("/delete-discount-code/:id", isAuthenticated, deleteDiscountCodes);
router.post("/upload-product-image", isAuthenticated, uploadProductImages);

export default router;