import { NextFunction, Request, Response } from "express";
import prisma from "@packages/libs/prisma";
import { ValidationError } from "@packages/error-handler";
import { imageKit } from "@packages/libs/imagekit";


// Get product categories
export const getCategories = async (req: Request, res: Response, next:NextFunction) => {
    try {
        const config = await prisma.site_config.findFirst();

        if (!config) {
            return res.status(404).json({message: "Categories not found"})
        }

        res.status(200).json({
            categories: config.categories,
            subCategories: config.subCategories,
        })
    } catch (error) {
        next(error);
    }
}

// Create discount codes
export const createDiscountCode = async(req: any, res: Response, next:NextFunction) => {
    try {
        const {public_name, discountType, discountValue, discountCode} = req.body;
        const isDiscountCodeExists = await prisma.discountCodes.findFirst({ where: {discountCode}});

        if (isDiscountCodeExists) {
            return res.status(400).json({message: "Discount code already exists"})
        }
        

        const discount_code = await prisma.discountCodes.create({
            data: {
                public_name,
                discountType,
                discountValue: parseFloat(discountValue),
                discountCode,
                sellerId: req.seller.id,
            }
        });

        res.status(201).json({message: "Discount code created successfully", discount_code})
    } catch (error) {
        next(error);
    }
}


// Get discount codes for seller
export const getDiscountCodes = async(req: any, res: Response, next:NextFunction) => {
    try {
        const sellerId = req.seller.id;
        const discountCodes = await prisma.discountCodes.findMany({
            where: { sellerId }
        });
        res.status(200).json({
            success: true,
            discount_codes: discountCodes
        })
    } catch (error) {
        next(error);
    }
}

// Delete discount codes
export const deleteDiscountCodes = async(req: any, res: Response, next:NextFunction) => {
    try {
        const { id } = req.params;
        const sellerId = req.seller.id;
        
        // Check discount code exists and belongs to the seller
        const discountCode = await prisma.discountCodes.findUnique({
            where: { id },
            select: { id: true, sellerId: true}
        });
 
        // If discount code not found or doesn't belong to the seller
        if (!discountCode) {
            return res.status(404).json({message: "Discount code not found"})
        }

        if (discountCode.sellerId !== sellerId) {
            return res.status(403).json({message: "You don't have permission to access this discount code"})
        }

        await prisma.discountCodes.delete({
            where: { id }
        });
        
        res.status(200).json({message: "Discount code deleted successfully"})
        
    } catch (error) {
        next(error);
    }
}

// Upload product images
export const uploadProductImages = async(req: Request, res: Response, next:NextFunction) => {
    try {
        const {fileName} = req.body;

        const response = await imageKit.upload({
            file: fileName,
            fileName: `product-${Date.now()}.jpg`,
            folder: "/products"
        });

        res.status(201).json({
            file_url: response.url
        })
    } catch (error) {
        next(error);
    }
}