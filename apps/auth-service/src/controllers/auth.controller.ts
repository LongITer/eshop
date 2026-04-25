import { NextFunction, Request, Response } from "express";
import { checkOtpRestrictions, handleForgotPassword, sendOtp, trackOtpRequests, validateRegistrationData, verifyForgotPasswordOtp, verifyOtp } from "../utils/auth.helper";
import { AuthError, ValidationError } from "@packages/error-handler";
import prisma from "@packages/libs/prisma";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import { setCookie } from "../utils/cookies/setCookies";

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

        if (!user) return next(new AuthError("User doesn't exists!"))

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password!);

        if (!isMatch) {
            return next(new AuthError("Invalid email or password!"))
        }

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