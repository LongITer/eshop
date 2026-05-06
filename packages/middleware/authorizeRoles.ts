import { AuthError } from "@packages/error-handler";
import { NextFunction, Request, Response } from "express";

export const isSeller = (req: Request, res: Response, next: NextFunction) => {
    if ((req as any).role !== "seller") {
        return next(new AuthError("Access denied: Seller only"))
    }
    next();
}

export const isUser = (req: Request, res: Response, next: NextFunction) => {
    if ((req as any).role !== "user") {
        return next(new AuthError("Access denied: User only"))
    }
    next();
}