import prisma from "@packages/libs/prisma";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";


const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get token
        const token = req.cookies['access_token'] ||
            req.cookies['seller_access_token'] ||
            req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                message: "Unauthorization! Token missing."
            })
        }

        // Verify token
        const decoded = await jwt.verify(token, process.env.ACCESS_TOKEN_JWT_SECRET!) as {
            id: string;
            role: "user" | "seller";
        }

        if (!decoded) {
            return res.status(401).json({
                message: "Unauthorized! Invalid Token."
            })
        }

        let account;
        if (decoded.role === "user") {
            account = await prisma.users.findUnique({ where: { id: decoded.id } });
            (req as any).user = account;
        } else {
            account = await prisma.sellers.findUnique({
                where: { id: decoded.id },
                include: { shop: true }
            });
            (req as any).seller = account;
        }

        if (!account) {
            return res.status(401).json({ message: "Unauthorized! Account not found." })
        }

        (req as any).role = decoded.role;

        return next();
    } catch (error: any) {
        console.error(error.message);
        return res.status(401).json({
            message: "Unauthorized! Token is invalid or expired!"
        })
    }
}

export default isAuthenticated;