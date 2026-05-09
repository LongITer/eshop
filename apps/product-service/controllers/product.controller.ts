import { NextFunction, Request, Response } from "express";
import prisma from "@packages/libs/prisma";


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