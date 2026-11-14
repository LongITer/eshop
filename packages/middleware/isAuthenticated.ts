import prisma from "@packages/libs/prisma";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { isSuspended } from '@packages/utils/admin-access';
import { sellerRemediationRequest } from '@packages/utils/seller-remediation-access';


const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get token
        const sessionRole = req.headers['x-session-role'];
        const cookieToken = sessionRole === 'seller' ? req.cookies?.seller_access_token
            : sessionRole === 'user' ? req.cookies?.access_token
            : req.cookies?.access_token || req.cookies?.seller_access_token;
        const token = req.headers.authorization?.split(' ')[1] || cookieToken;

        if (!token) {
            return res.status(401).json({
                message: "Unauthorization! Token missing."
            })
        }

        // Verify token
        const decoded = await jwt.verify(token, process.env.ACCESS_TOKEN_JWT_SECRET!) as {
            id: string;
            role: "user" | "seller" | "admin";
        }

        if (!decoded || !['user', 'seller', 'admin'].includes(decoded.role) || !/^[a-f\d]{24}$/i.test(decoded.id)) {
            return res.status(401).json({
                message: "Unauthorized! Invalid Token."
            })
        }

        let account;
        if (decoded.role === "user") {
            account = await prisma.users.findUnique({ where: { id: decoded.id } });
            (req as any).user = account;
        } else if (decoded.role === "seller") {
            account = await prisma.sellers.findUnique({
                where: { id: decoded.id },
                include: { shop: true }
            });
            (req as any).seller = account;
        } else {
            account = await prisma.users.findUnique({ where: { id: decoded.id } });
            (req as any).user = account;
        }

        if (!account) {
            return res.status(401).json({ message: "Unauthorized! Account not found." })
        }

        if (isSuspended(account) && !(decoded.role === 'seller' && sellerRemediationRequest(req.path, req.method))) {
            return res.status(403).json({ message: 'Account suspended. Contact support.' });
        }

        // Customer sessions carry only customer permissions, even when the
        // account can also sign in as an administrator. Privileged sessions
        // must still lose access when their account role is revoked.
        if (decoded.role === 'admin' && (account as any).role !== 'admin') {
            return res.status(401).json({ message: 'Account role changed. Please sign in again.' });
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
