import { NextFunction, Request, Response } from "express";
import { AppError } from ".";

export const errorMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    if ((err as any).code === 'P2002') return res.status(409).json({ message: 'This value already exists. Please use a different value or reload and retry.' });
    if ((err as any).code === 'P2025') return res.status(404).json({ message: 'The record no longer exists or has changed. Reload and retry.' });
    if ((err as any).code === 'P2034') return res.status(409).json({ message: 'Another update is in progress. Please retry.' });
    if (err instanceof AppError) {
        console.log(`Error ${req.method} - ${req.url} - ${err.message}`)

        return res.status(err.statusCode).json({
            status: "error",
            message: err.message,
            ...(err.details && { details: err.details })
        })
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({
            status: "error",
            message: "Unauthorized! Invalid or expired token."
        })
    }

    console.log("Unhandle error: ", err)
    return res.status(500).json({
        error: "Something went wrong. Please try again!"
    })
}


