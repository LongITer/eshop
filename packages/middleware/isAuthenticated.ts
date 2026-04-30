import prisma from "@packages/libs/prisma";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";


const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get token
        const token = req.cookies.access_token || req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                message: "Unauthorization! Token missing."
            })
        }

        // Verify token
        const decoded = await jwt.verify(token, process.env.ACCESS_TOKEN_JWT_SECRET!) as {
            id: string;
            role: "user" | "admin";
        }

        if (!decoded) {
            return res.status(401).json({
                message: "Unauthorized! Invalid Token."
            })
        }

        const account = await prisma.users.findUnique({ where: { id: decoded.id } });

        if (!account) {
            return res.status(401).json({ message: "Unauthorized! Account not found." })
        }

        (req as any).user = account;

        return next();
    } catch (error) {
        next(error);
    }
}

export default isAuthenticated;