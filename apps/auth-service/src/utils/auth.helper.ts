import crypto from "crypto";
import { ValidationError } from "@packages/error-handler";
import redis from "@packages/libs/redis";
import { sendEmail } from "./sendMail";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateRegistrationData = (data: any, userType: "user" | "seller") => {
    const { name, email, password, phone_number, country } = data;

    if (
        !name ||
        !email ||
        !password ||
        (userType === "seller" && (!phone_number || !country))
    ) {
        throw new ValidationError("Missing required fields!")
    }

    if (!emailRegex.test(email)) {
        throw new ValidationError('Invalid email format!')
    }
}

export const checkOtpRestrictions = async (email: string) => {
    if (await redis.get(`otp_lock:${email}`)) {
        throw new ValidationError("Account locked due to multiple failed attempts. Try again after 30 minutes");
    }
    if (await redis.get(`otp_spam_lock:${email}`)) {
        throw new ValidationError("Too many OTP requests. Please await 1 hour before requesting again");
    }
    if (await redis.get(`otp_cooldown:${email}`)) {
        throw new ValidationError("Please wait 60 seconds before requesting another OTP");
    }
}

export const trackOtpRequests = async (email: string) => {
    const otpRequestKey = `otp_request_count:${email}`;
    let otpRequest = parseInt((await redis.get(otpRequestKey)) || "0");

    if (otpRequest >= 2) {
        await redis.set(`otp_spam_lock:${email}`, 'locked', 'EX', 3600);
        throw new ValidationError("Too many OTP requests. Please await 1 hour before requesting again");
    }

    await redis.set(otpRequestKey, otpRequest + 1, 'EX', 3600);
}

export const sendOtp = async (name: string, email: string, template: string) => {
    const otp = crypto.randomInt(1000, 9999).toString();
    await sendEmail(email, "Verify Your Email", template, { name, otp });
    await redis.set(`otp:${email}`, otp, "EX", 300);
    await redis.set(`otp_cooldown:${email}`, "true", "EX", 60);
}

export const verifyOtp = async (email: string, otp: string) => {
    const storedOtp = await redis.get(`otp:${email}`);
    if (!storedOtp) {
        throw new ValidationError("Invalid or expired otp!");
    }

    const failedAttemptKeys = `otp_attempts:${email}`;
    const failedAttempts = parseInt((await redis.get(failedAttemptKeys)) || "0");

    if (storedOtp !== otp) {
        if (failedAttempts >= 2) {
            await redis.set(`otp_lock:${email}`, "locked", "EX", 1800); // Lock for 30 minutes
            await redis.del(`otp:${email}`, failedAttemptKeys)
            throw new ValidationError("Too many failed attempts. Your account is locked for 30 minutes!");
        }
        await redis.set(failedAttemptKeys, failedAttempts + 1, "EX", 1800);
        throw new ValidationError(`Incorrect OTP. ${2 - failedAttempts} attempts remaining`)
    }

    await redis.del(`otp:${email}`, failedAttemptKeys, `otp_request_count:${email}`);
    return true;
}