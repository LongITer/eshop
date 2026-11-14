'use client'
import { useStorefrontText } from '@packages/components/storefront-language';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useRef, useState } from 'react'
import { useForm } from 'react-hook-form';
// import { Loader2 } from 'lucide-react';
import axios, { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

type FormData = {
    email: string,
    password: string,

}
const ForgotPassword = () => {
  const { t } = useStorefrontText();
    const [step, setStep] = useState<"email" | "otp" | "reset">("email");
    const [serverError, setServerError] = useState<string | null>(null);
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [canResend, setCanResend] = useState(true);
    const [timer, setTimer] = useState(60);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const router = useRouter();

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

    const startResendTimer = () => {
        setCanResend(false);
        setTimer(60);
        const interval = setInterval(() => {
            setTimer((prev) => {
                if (prev === 1) {
                    clearInterval(interval);
                    setCanResend(true);
                }
                return prev - 1;
            })
        }, 1000);
    }

    const requestOtpMutation = useMutation({
        mutationFn: async ({ email }: { email: string }) => {
            const response = await axios.post("/api/forgot-password-user", { email });
            return response.data;
        },
        onSuccess: (_, { email }) => {
            setUserEmail(email);
            startResendTimer();
            setStep("otp");
            setServerError(null);
            setCanResend(false);
        },
        onError: (error: AxiosError) => {
            console.log("Forgot password error:", error.response?.status, error.response?.data);
            const errorMessage = (error.response?.data as { message?: string })?.message
                || "Failed to send OTP. Please try again.";
            setServerError(errorMessage);
        }
    })

    const verifyOtpMutation = useMutation({
        mutationFn: async () => {
            if (!userEmail) return;
            const response = await axios.post("/api/verify-forgot-password-user",
                { email: userEmail, otp: otp.join("") })
            return response.data;
        },
        onSuccess: () => {
            setStep("reset");
            setServerError(null);
        },
        onError: (error: AxiosError) => {
            console.log("Verify OTP error:", error.response?.status, error.response?.data);
            const errorMessage = (error.response?.data as { message?: string })?.message
                || "Invalid OTP. Please try again.";
            setServerError(errorMessage);
        }
    })

    const resetPasswordMutation = useMutation({
        mutationFn: async ({ password }: { password: string }) => {
            if (!password) return;
            const response = await axios.post("/api/reset-password-user",
                { email: userEmail, newPassword: password });
            return response.data;
        },
        onSuccess: () => {
            setStep('email');
            toast.success(t("Password reset successful!"));
            setServerError(null);
            router.push('/login');
        },
        onError: (error: AxiosError) => {
            const errorMessage = (error.response?.data as { message?: string })?.message
                || "Failed to reset password. Please try again.";
            setServerError(errorMessage);
        }
    })

    const onSubmitEmail = ({ email }: { email: string }) => {
        requestOtpMutation.mutate({ email });
    }

    const onSubmitPassword = ({ password }: { password: string }) => {
        resetPasswordMutation.mutate({ password });
    }

    const handleOtpChange = (index: number, value: string) => {
        if (/[^0-9]/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        setServerError(null);
        if (value && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }
    }

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }



    const resendOtp = () => {
        if (userEmail) {
            requestOtpMutation.mutate({ email: userEmail });
            setOtp(["", "", "", ""]);
            setCanResend(false);
            setTimer(60);
        }
    }

    return (
        <div className='w-full py-10 min-h-[85vh] bg-[#f1f1f1]'>
            <h1 className='text-4xl font-Poppins font-semibold text-black text-center'>
                {t("Forgot Password")}</h1>
            <p className='text-center text-lg font-medium py-3 text-[#00000099]'>
                {t("Home . Forgot Password")}</p>
            <div className='w-full flex justify-center'>
                <div className='md:w-[480px] p-8 bg-white shadow rounded-lg'>
                    {step === "email" && (
                        <>
                            <h3 className='text-2xl font-semibold text-center mb-2'>
                                {t("Login to Eshop")}</h3>
                            <p className='text-center text-gray-500 mb-4'>
                                {t("Go back to ")}{" "}
                                <Link href={'/login'} className='text-blue-500'>
                                    {t("Login")}</Link>
                            </p>

                            <form onSubmit={handleSubmit(onSubmitEmail)}>
                                <label className='block text-gray-700 mb-1'>Email</label>
                                <input type="email" placeholder='name@gmail.com'
                                    className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                                    {...register("email", {
                                        required: t("Email is required"),
                                        pattern: {
                                            value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
                                            message: t("Please enter a valid email address")
                                        }
                                    })}
                                />

                                {errors.email && (
                                    <p className='text-red-500 text-sm'>
                                        {t(String(errors.email?.message || ""))}
                                    </p>

                                )}

                                <button
                                    type="submit"
                                    disabled={requestOtpMutation.isPending}
                                    className='w-full mt-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600'>
                                    {requestOtpMutation.isPending ? t("Sending OTP...") : t("Send Reset Link")}
                                </button>

                                {serverError && (
                                    <p className='text-red-500 text-sm mt-4'>
                                        {t(serverError || "")}
                                    </p>
                                )}
                            </form>
                        </>
                    )}

                    {
                        step === "otp" && (
                            <>
                                <h3 className='text-xl font-semibold text-center mb-4'>{t("Enter OTP")}</h3>
                                <div className='flex justify-center gap-4'>
                                    {otp.map((digit, index) => (
                                        <input
                                            key={index}
                                            type='text'
                                            ref={(el) => { if (el) inputRefs.current[index] = el; }}
                                            maxLength={1}
                                            className='w-12 h-12 text-center border border-gray-300 outline-none rounded-xl text-xl font-bold focus:border-blue-500'
                                            value={digit}
                                            onChange={(e) => handleOtpChange(index, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        />
                                    ))}
                                </div>

                                <button
                                    onClick={() => verifyOtpMutation.mutate()}
                                    disabled={verifyOtpMutation.isPending}
                                    className='w-full mt-6 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 flex justify-center items-center'
                                >
                                    {verifyOtpMutation.isPending ? <Loader2 className="animate-spin" /> : t("Verify OTP")}
                                </button>

                                <div className='text-center text-sm mt-4'>
                                    {canResend ? (
                                        <button onClick={resendOtp} className='text-blue-500 hover:underline'>
                                            {t("Resend OTP")}</button>
                                    ) : (
                                        <span className="text-gray-400">{t("Resend OTP in ")}{timer}s</span>
                                    )}
                                </div>
                                {serverError && <p className='text-red-500 text-sm mt-4 text-center'>{t(serverError || "")}</p>}

                                <button
                                    onClick={() => setStep("email")}
                                    className='w-full mt-2 text-sm text-gray-500 hover:underline'
                                >
                                    {t("Back to Signup")}</button>
                            </>
                        )
                    }

                    {
                        step === "reset" && (
                            <>
                                <h3 className='text-xl font-semibold text-center mb-4'>{t("Reset Password")}</h3>
                                <form onSubmit={handleSubmit(onSubmitPassword)}>
                                    <label className='block text-gray-700 mb-1'>{t("New Password")}</label>
                                    <input type="password" placeholder={t('Your new password')}
                                        className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                                        {...register("password", {
                                            required: t("Password is required"),
                                            minLength: {
                                                value: 6,
                                                message: t("Password must be at least 6 characters")
                                            }
                                        })}
                                    />
                                    {errors.password && <p className='text-red-500 text-sm'>{t(String(errors.password.message || ""))}</p>}
                                    {serverError && <p className='text-red-500 text-sm mt-4 text-center'>{t(serverError || "")}</p>}
                                    <button
                                        type='submit'
                                        disabled={resetPasswordMutation.isPending}
                                        className='w-full mt-6 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 flex justify-center items-center'
                                    >
                                        {resetPasswordMutation.isPending ? <Loader2 className="animate-spin" /> : t("Reset Password")}
                                    </button>
                                </form>
                            </>
                        )
                    }
                </div>
            </div>
        </div>
    )
}

export default ForgotPassword