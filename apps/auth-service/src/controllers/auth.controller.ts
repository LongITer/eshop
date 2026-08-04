import { NextFunction, Request, Response } from "express";
import { checkOtpRestrictions, handleForgotPassword, sendOtp, trackOtpRequests, validateRegistrationData, verifyForgotPasswordOtp, verifyOtp } from "../utils/auth.helper";
import { AuthError, ValidationError, AppError } from "@packages/error-handler";
import prisma from "@packages/libs/prisma";
import bcrypt from "bcryptjs";
import jwt, { JsonWebTokenError } from 'jsonwebtoken';
import { setCookie } from "../utils/cookies/setCookies";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia'
});

// Register a new user
export const userRegistration = async (req: Request, res: Response, next: NextFunction) => {
    try {
        validateRegistrationData(req.body, 'user');
        const { name, email } = req.body;

        const existingUser = await prisma.users.findUnique({
            where: { email }
        })

        if (existingUser) {
            return next(new ValidationError("User already exists with this email!"))
        }

        await checkOtpRestrictions(email);
        await trackOtpRequests(email);
        await sendOtp(name, email, "user-activation-mail");

        res.status(200).json({
            message: "OTP sent to mail. Please verify your account."
        })
    } catch (error) {
        if (!res.headersSent) return next(error);
    }
}

// Verify user with otp
export const verifyUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, otp, password, name } = req.body;
        if (!email || !otp || !password || !name) {
            return next(new ValidationError("All fields are required"))
        }

        const existingUser = await prisma.users.findUnique({
            where: { email }
        })

        if (existingUser) {
            return next(new ValidationError("User already exists with this email!"))
        }

        await verifyOtp(email, otp);

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.users.create({
            data: { name, email, password: hashedPassword }
        });

        res.status(201).json({
            success: true,
            message: "User registered successfully"
        })
    } catch (error) {
        if (!res.headersSent) next(error);
    }
}

// Login user
export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return next(new ValidationError("Email and password are required!"))
        }

        const user = await prisma.users.findUnique({ where: { email } });

        if (!user) return next(new AuthError("Invalid email or password!"))

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password!);

        if (!isMatch) {
            return next(new AuthError("Invalid email or password!"))
        }
        // Delete seller token
        res.clearCookie("seller_access_token");
        res.clearCookie("seller_refresh_token");
        // Generate access token and refresh token
        const accessToken = await jwt.sign({ id: user.id, role: "user" },
            process.env.ACCESS_TOKEN_JWT_SECRET as string,
            {
                expiresIn: '15m'
            }
        )

        const refreshToken = await jwt.sign({ id: user.id, role: "user" },
            process.env.REFRESH_TOKEN_JWT_SECRET as string,
            {
                expiresIn: '7d'
            }
        )

        // Store the refresh and access token in httpOnly secure cookies
        setCookie(res, "refresh_token", refreshToken);
        setCookie(res, "access_token", accessToken);

        res.status(200).json({
            message: "Login successfully",
            user: { id: user.id, email: user.email, name: user.name }
        })
    } catch (error) {
        return next(error);
    }
}

// Refresh token for User
export const refreshUserToken = async (req: any, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies['refresh_token'] || req.headers.authorization?.split(' ')[1];

        if (!token) {
            return next(new ValidationError("Unauthorized! No refresh token!"));
        }

        const decoded = jwt.verify(
            token,
            process.env.REFRESH_TOKEN_JWT_SECRET as string
        ) as { id: string, role: string };

        if (!decoded || !decoded.id || decoded.role !== 'user') {
            return next(new JsonWebTokenError("Forbidden! Invalid user refresh token!"));
        }

        const account = await prisma.users.findUnique({ where: { id: decoded.id } });

        if (!account) {
            return next(new AuthError("Forbidden! User not found!"));
        }

        const newAccessToken = jwt.sign(
            { id: decoded.id, role: 'user' },
            process.env.ACCESS_TOKEN_JWT_SECRET as string,
            { expiresIn: '15m' }
        );

        setCookie(res, "access_token", newAccessToken);

        req.role = decoded.role;
        req.user = account;

        return res.status(201).json({
            success: true,
            message: "Access token refreshed successfully!"
        })
    } catch (error) {
        return next(error);
    }
}

// Refresh token for Seller
export const refreshSellerToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies['seller_refresh_token'] || req.headers.authorization?.split(' ')[1];

        if (!token) {
            return next(new ValidationError("Unauthorized! No seller refresh token!"));
        }

        const decoded = jwt.verify(
            token,
            process.env.REFRESH_TOKEN_JWT_SECRET as string
        ) as { id: string, role: string };

        if (!decoded || !decoded.id || decoded.role !== 'seller') {
            return next(new JsonWebTokenError("Forbidden! Invalid seller refresh token!"));
        }

        const account = await prisma.sellers.findUnique({
            where: { id: decoded.id },
            include: { shop: true }
        });

        if (!account) {
            return next(new AuthError("Forbidden! Seller not found!"));
        }

        const newAccessToken = jwt.sign(
            { id: decoded.id, role: 'seller' },
            process.env.ACCESS_TOKEN_JWT_SECRET as string,
            { expiresIn: '15m' }
        );

        setCookie(res, "seller_access_token", newAccessToken);

        return res.status(201).json({
            success: true,
            message: "Access token refreshed successfully!"
        })
    } catch (error) {
        return next(error);
    }
}

// Get logged user
export const getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;
        if (!user) {
            return next(new ValidationError("User not found"))
        }

        res.status(200).json({
            success: true,
            user
        })
    } catch (error) {
        return next(error);
    }
}

// User forgot password
export const userForgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    await handleForgotPassword(req, res, next, 'user')
}

// Verify forgot password otp
export const verifyUserForgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    await verifyForgotPasswordOtp(req, res, next, 'user');
}

// Reset user password
export const resetUserPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, newPassword } = req.body;
        if (!email || !newPassword)
            return next(new ValidationError("Email and password are required"));

        const user = await prisma.users.findUnique({ where: { email } });
        if (!user) return next(new ValidationError("User not found"));

        // Compare new password with existing one
        const isSamePassword = await bcrypt.compare(newPassword, user.password!);

        if (isSamePassword) {
            return next(new ValidationError("New password cannot be the same as the old password"));
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // Update user password
        await prisma.users.update({
            where: { email },
            data: { password: hashedPassword }
        })

        res.status(200).json({
            message: "Password reset successfully!"
        })
    } catch (error) {
        next(error);
    }
}

// Register a new seller
export const registerSeller = async (req: Request, res: Response, next: NextFunction) => {
    try {
        validateRegistrationData(req.body, 'seller');
        const { name, email } = req.body;

        const existingSeller = await prisma.sellers.findUnique({
            where: { email }
        })

        if (existingSeller) {
            throw new ValidationError("Seller already exists with this email")
        }

        // Otp validation
        await checkOtpRestrictions(email)
        await trackOtpRequests(email)
        await sendOtp(name, email, "seller-activation-mail")

        res.status(200).json({
            success: true,
            message: "OTP sent to mail. Please verify your account."
        })
    } catch (error) {
        next(error);
    }
}

// Verify seller with OTP
export const verifySeller = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, otp, password, name, phone_number, country } = req.body;
        if (!email || !otp || !password || !name || !phone_number || !country) {
            return next(new ValidationError("All fields are required"))
        }

        const existingSeller = await prisma.sellers.findUnique({ where: { email } });
        if (existingSeller) {
            return next(new ValidationError("Seller already exists with this email"));
        }

        await verifyOtp(email, otp);

        const hashedPassword = await bcrypt.hash(password, 10);

        const seller = await prisma.sellers.create({
            data: {
                name,
                email,
                password: hashedPassword,
                country,
                phone_number,
            }
        })

        res.status(200).json({
            seller,
            message: "Seller registered successfully"
        })
    } catch (error) {
        next(error);
    }
}

// Create a new shop
export const createShop = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, bio, address, opening_hours, website, category, sellerId } = req.body;

        if (!name || !address || !sellerId || !opening_hours || !category || !bio) {
            return next(new ValidationError("All fields are required"));
        }

        const shopData = {
            name,
            bio,
            address,
            category,
            website,
            opening_hours,
            sellerId
        }

        if (website && !website.trim("")) {
            shopData.website = website.trim()
        }

        const shop = await prisma.shops.create({
            data: shopData,
        });

        res.status(201).json({
            success: true,
            shop,
            message: "Shop created successfully"
        })
    } catch (error) {
        next(error)
    }
}

// Create stripe connect account link
export const createStripeConnectLink = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sellerId } = req.body;

        if (!sellerId) return next(new ValidationError("Seller ID is required"));

        const seller = await prisma.sellers.findUnique({ where: { id: sellerId } });

        if (!seller) return next(new ValidationError("Seller not found"));

        let stripeAccountId = seller.stripe_id;

        if (!stripeAccountId) {
            // Create a new account if one doesn't exist
            try {
                const account = await stripe.accounts.create({
                    type: "express",
                    email: seller.email,
                    country: "US", // Hardcoded to US for testing purposes to avoid unsupported country errors
                    capabilities: {
                        card_payments: { requested: true },
                        transfers: { requested: true },
                    },
                });
                stripeAccountId = account.id;

                await prisma.sellers.update({
                    where: { id: sellerId },
                    data: { stripe_id: stripeAccountId }
                });
            } catch (stripeError: any) {
                console.error("Stripe Account Creation Error:", stripeError);
                return next(new AppError(
                    stripeError.message || "Failed to create Stripe account. Please ensure Connect is enabled in your Stripe Dashboard.",
                    400
                ));
            }
        }

        try {
            const accountLink = await stripe.accountLinks.create({
                account: stripeAccountId!,
                refresh_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/success`,
                return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/success`,
                type: 'account_onboarding',
            });

            return res.json({ url: accountLink.url })
        } catch (stripeError: any) {
            console.error("Stripe Account Link Error:", stripeError);
            return next(new AppError(
                stripeError.message || "Failed to create Stripe onboarding link.",
                400
            ));
        }
    } catch (error) {
        return next(error);
    }
}

// Login seller
export const loginSeller = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return next(new ValidationError("Email and password are required!"))
        }

        const seller = await prisma.sellers.findUnique({ where: { email } });

        if (!seller) return next(new AuthError("Invalid email or password!"))

        // Verify password
        const isMatch = await bcrypt.compare(password, seller.password!);

        if (!isMatch) {
            return next(new AuthError("Invalid email or password!"))
        }
        // Delete user token
        res.clearCookie("access_token");
        res.clearCookie("refresh_token");
        // Generate access token and refresh token
        const accessToken = await jwt.sign({ id: seller.id, role: "seller" },
            process.env.ACCESS_TOKEN_JWT_SECRET as string,
            {
                expiresIn: '15m'
            }
        )

        const refreshToken = await jwt.sign({ id: seller.id, role: "seller" },
            process.env.REFRESH_TOKEN_JWT_SECRET as string,
            {
                expiresIn: '7d'
            }
        )

        // Store the refresh and access token in httpOnly secure cookies
        setCookie(res, "seller_refresh_token", refreshToken);
        setCookie(res, "seller_access_token", accessToken);

        res.status(200).json({
            message: "Login successfully",
            seller: { id: seller.id, email: seller.email, name: seller.name }
        })
    } catch (error) {
        return next(error);
    }

}

// get logged in seller
export const getSeller = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const seller = (req as any).seller;
        if (!seller) {
            return next(new ValidationError("Seller not found"))
        }

        res.status(200).json({
            success: true,
            seller
        })
    } catch (error) {
        return next(error);
    }
}
