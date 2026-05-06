'use client'
import Link from 'next/link';
import React, { useRef, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form';

import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';

import { countries } from '../../utils/countries';
import CreateShop from '../../shared/modules/create-shop';

import StripeLogo from '../../assets/svgs/stripe.logo';

type FormData = {
    name: string,
    email: string,
    password: string,
    phone_number: string,
    country: string,
}



const Signup = () => {
    const [activeStep, setActiveStep] = useState(1)
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [canResend, setCanResend] = useState(true);
    const [showOtp, setShowOtp] = useState(false);
    const [timer, setTimer] = useState(60);
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [sellerData, setSellerData] = useState<FormData | null>(null);
    const [sellerId, setSellerId] = useState("");
    const [stripeLoading, setStripeLoading] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);


    const { register, handleSubmit, formState: { errors } } = useForm<FormData>();


    // Bộ đếm ngược cho Resend OTP
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (!canResend && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        } else if (timer === 0) {
            setCanResend(true);
        }
        return () => clearInterval(interval);
    }, [canResend, timer]);

    // Mutation 1: Đăng ký ban đầu (Gửi OTP về mail)
    const signupMutation = useMutation({
        mutationFn: async (data: FormData) => {
            const response = await axios.post(`/api/seller-registration`, data);
            return response.data;
        },
        onSuccess: (_, formData) => {
            setSellerData(formData);
            setShowOtp(true);
            setCanResend(false);
            setTimer(60);
            setServerError(null);
        },
        onError: (error: any) => {
            setServerError(error.response?.data?.message || 'Không thể đăng ký. Vui lòng thử lại.');
        }
    });

    // Mutation 2: Xác thực mã OTP
    const verifyOtpMutation = useMutation({
        mutationFn: async (otpCode: string) => {
            if (!sellerData) {
                throw new Error("Seller data not found");
            }
            const response = await axios.post(`/api/verify-seller`, {
                ...sellerData,
                otp: otpCode
            });
            return response.data;
        },
        onSuccess: (data) => {
            setSellerId(data?.seller?.id);
            setActiveStep(2);
        },
        onError: (error: any) => {
            setServerError(error.response?.data?.message || 'Invalid OTP');
        }
    });



    const onSubmit = (data: FormData) => {
        signupMutation.mutate(data);
    }



    const handleVerifyOtp = () => {
        const otpCode = otp.join("");
        if (otpCode.length < 4) {
            setServerError("Please enter the full 4-digit OTP code.");
            return;
        }
        verifyOtpMutation.mutate(otpCode);
    }

    const resendOtp = () => {
        if (sellerData) {
            signupMutation.mutate(sellerData);
            setOtp(["", "", "", ""]);
            setCanResend(false);
            setTimer(60);
        }
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

    const connectStripe = async () => {
        setStripeLoading(true);
        try {
            const response = await axios.post(`/api/create-stripe-link`,
                { sellerId },
            );

            if (response.data.url) {
                window.location.href = response.data.url;
            }

        } catch (error) {
            console.error("Error connecting to Stripe:", error);
        } finally {
            setStripeLoading(false);
        }
    }

    return (
        <div className="w-full flex flex-col items-center pt-10 min-h-screen">
            {/* Stepper */}
            <div className='relative flex items-center justify-between md:w-[50%] mb-8'>
                <div className='absolute top-[25%] left-0 w-[80%] md:w-[95%] h-1 bg-gray-300 -z-10' />
                {[1, 2, 3].map((step) => (
                    <div key={step}>
                        <div className={`w-10 h-10 flex items-center justify-center rounded-full text-white font-bold 
                            ${step <= activeStep ? 'bg-blue-500' : 'bg-gray-400'}`}>
                            {step}
                        </div>
                        <span className='ml-[-30px]'>
                            {step === 1 ? "Create Account" : step === 2 ? "Setup Shop" : "Connect Bank"}
                        </span>
                    </div>
                ))}
            </div>

            {/* Steps content */}
            <div className='md:w-[480px] p-8 bg-white shadow rounded-lg'>
                {activeStep === 1 && (
                    <>
                        {!showOtp ? (
                            <form onSubmit={handleSubmit(onSubmit)}>
                                <h3 className='text-2xl font-semibold text-center mb-2'>Create Account</h3>
                                <p className='text-center text-gray-500 mb-4'>
                                    Enter your details to create an account
                                </p>

                                {/* Name */}
                                <label className='block text-gray-700 mb-1'>Name</label>
                                <input type="text" placeholder='Your name'
                                    className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                                    {...register("name", { required: "Name is required" })}
                                />
                                {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}

                                {/* Email */}
                                <label className='block text-gray-700 mb-1 mt-2'>Email</label>
                                <input type="email" placeholder='name@gmail.com'
                                    className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                                    {...register("email", {
                                        required: "Email is required",
                                        pattern: { value: /^\S+@\S+$/i, message: "Invalid email" }
                                    })}
                                />
                                {errors.email && <p className='text-red-500 text-sm'>{errors.email.message}</p>}

                                {/* Phone Number */}
                                <label className='block text-gray-700 mb-1 mt-2'>Phone Number</label>
                                <input type="tel" placeholder='0912345678'
                                    className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                                    {...register("phone_number", {
                                        required: "Phone number is required",
                                        pattern: {
                                            value: /^\+?[1-9]\d{1,14}$/,
                                            message: "Invalid phone number"
                                        },
                                        minLength: {
                                            value: 10,
                                            message: "Phone number must be at least 10 digits"
                                        },
                                        maxLength: {
                                            value: 15,
                                            message: "Phone number must be at most 15 digits"
                                        }
                                    })}
                                />
                                {errors.phone_number && <p className='text-red-500 text-sm'>{errors.phone_number.message}</p>}

                                {/* Country */}
                                <label className='block text-gray-700 mb-1 mt-2'>Country</label>
                                <select
                                    className="w-full p-2 border border-gray-300 outline-0 rounded mb-1"
                                    {...register("country", {
                                        required: "Country is required",
                                    })}
                                >
                                    <option value="" disabled>Select your country</option>
                                    {countries.map((country) => (
                                        <option key={country.code} value={country.code}>
                                            {country.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.country && <p className='text-red-500 text-sm'>{errors.country.message}</p>}

                                {/* Password */}
                                <label className='block text-gray-700 mb-1 mt-2'>Password</label>
                                <div className="relative">
                                    <input
                                        type={passwordVisible ? "text" : "password"}
                                        placeholder='Min 6 characters'
                                        className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                                        {...register("password", {
                                            required: "Password is required",
                                            minLength: { value: 6, message: "Min 6 characters" }
                                        })}
                                    />
                                    <button type="button" onClick={() => setPasswordVisible(!passwordVisible)}
                                        className="absolute inset-y-0 right-4 flex items-center text-gray-400"
                                    >
                                        {passwordVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                                    </button>
                                </div>
                                {errors.password && <p className='text-red-500 text-sm'>{errors.password.message}</p>}

                                {/* Signup Button */}
                                <button
                                    type="submit"
                                    disabled={signupMutation.isPending}
                                    className='w-full mt-6 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 flex justify-center items-center'
                                >
                                    {signupMutation.isPending ? <Loader2 className="animate-spin" /> : "Signup"}
                                </button>

                                {signupMutation.isError && (
                                    signupMutation.error instanceof AxiosError &&
                                    <p className='text-red-500 text-sm mt-4 text-center'>
                                        {signupMutation.error.response?.data.message} || {signupMutation.error.message}
                                    </p>
                                )}

                                <p className='text-sm text-center mt-2'>
                                    Already have an account?{" "}
                                    <Link href="/login" className='text-blue-500 hover:underline'>
                                        Login
                                    </Link>
                                </p>
                            </form>
                        ) : (
                            <div>
                                <h3 className='text-xl font-semibold text-center mb-4'>Enter OTP</h3>
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
                                    onClick={handleVerifyOtp}
                                    disabled={verifyOtpMutation.isPending}
                                    className='w-full mt-6 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 flex justify-center items-center'
                                >
                                    {verifyOtpMutation.isPending ? <Loader2 className="animate-spin" /> : "Verify OTP"}
                                </button>

                                <div className='text-center text-sm mt-4'>
                                    {canResend ? (
                                        <button onClick={resendOtp} className='text-blue-500 hover:underline'>
                                            Resend OTP
                                        </button>
                                    ) : (
                                        <span className="text-gray-400">Resend OTP in {timer}s</span>
                                    )}
                                </div>
                                {serverError && <p className='text-red-500 text-sm mt-4 text-center'>{serverError}</p>}




                            </div>
                        )}
                    </>
                )}

                {activeStep === 2 && (
                    <CreateShop sellerId={sellerId} setActiveStep={setActiveStep} />
                )}

                {activeStep === 3 && (
                    <div className="text-center">
                        <h3 className='text-2xl font-semibold'>Withdraw method</h3>
                        <br />
                        <button
                            className='w-full m-auto flex items-center justify-center gap-3 bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
                            onClick={connectStripe}
                            disabled={stripeLoading}
                        >
                            {stripeLoading ? <Loader2 className='animate-spin' /> : (
                                <>Connect Stripe <StripeLogo /></>
                            )}
                        </button>
                    </div>
                )}
            </div>

        </div>
    )
}

export default Signup