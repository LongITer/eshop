'use client'
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useRef, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form';
import GoogleButton from '../../shared/components/google-button';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

type FormData = {
    name: string,
    email: string,
    password: string,
}

const Signup = () => {
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [canResend, setCanResend] = useState(true);
    const [showOtp, setShowOtp] = useState(false);
    const [timer, setTimer] = useState(60);
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [userData, setUserData] = useState<FormData | null>(null);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const router = useRouter();
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
            const response = await axios.post(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/user-registration`, data);
            return response.data;
        },
        onSuccess: (_, formData) => {
            setUserData(formData);
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
            if (!userData) {
                throw new Error("User data not found");
            }
            const response = await axios.post(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/verify-user`, {
                ...userData,
                otp: otpCode
            });
            return response.data;
        },
        onSuccess: () => {
            alert("Sign in successful!");
            router.push('/login');
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
        if (userData) {
            signupMutation.mutate(userData);
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

    return (
        <div className='w-full py-10 min-h-[85vh] bg-[#f1f1f1]'>
            <h1 className='text-4xl font-Poppins font-semibold text-black text-center'>Signup</h1>
            <p className='text-center text-lg font-medium py-3 text-[#00000099]'>Home . Signup</p>

            <div className='w-full flex justify-center'>
                <div className='md:w-[480px] p-8 bg-white shadow rounded-lg'>
                    <h3 className='text-2xl font-semibold text-center mb-2'>Signup to Eshop</h3>
                    <p className='text-center text-gray-500 mb-4'>
                        Already have an account? <Link href={'/login'} className='text-blue-500'>Login</Link>
                    </p>

                    <GoogleButton />

                    <div className='flex items-center my-5 text-gray-500 text-sm'>
                        <div className='flex-1 border-t border-gray-300' />
                        <span className='px-3'>or Sign in with Email</span>
                        <div className='flex-1 border-t border-gray-300' />
                    </div>

                    {!showOtp ? (
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <label className='block text-gray-700 mb-1'>Name</label>
                            <input type="text" placeholder='Your name'
                                className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                                {...register("name", { required: "Name is required" })}
                            />
                            {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}

                            <label className='block text-gray-700 mb-1 mt-2'>Email</label>
                            <input type="email" placeholder='name@gmail.com'
                                className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                                {...register("email", {
                                    required: "Email is required",
                                    pattern: { value: /^\S+@\S+$/i, message: "Invalid email" }
                                })}
                            />
                            {errors.email && <p className='text-red-500 text-sm'>{errors.email.message}</p>}

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

                            <button
                                type="submit"
                                disabled={signupMutation.isPending}
                                className='w-full mt-6 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 flex justify-center items-center'
                            >
                                {signupMutation.isPending ? <Loader2 className="animate-spin" /> : "Signup"}
                            </button>

                            {serverError && <p className='text-red-500 text-sm mt-4 text-center'>{serverError}</p>}
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

                            <button
                                onClick={() => setShowOtp(false)}
                                className='w-full mt-2 text-sm text-gray-500 hover:underline'
                            >
                                Back to Signup
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Signup