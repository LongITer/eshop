'use client'
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react'
import { useForm } from 'react-hook-form';
import GoogleButton from '../../shared/components/google-button';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import axios, { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

type FormData = {
    email: string,
    password: string,

}
const Login = () => {
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [rememberMe, setRememberMe] = useState(false)
    const router = useRouter();
    const { register, handleSubmit, formState: { errors } } = useForm<FormData>();


    const loginMutation = useMutation({
        mutationFn: async (data: FormData) => {
            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_SERVER_URL}/api/login-user`,
                data,
                { withCredentials: true }
            );
            return response.data;
        },
        onSuccess: () => {
            setServerError(null);
            toast.success("Login successful!");
            router.push('/');
        },
        onError: (error: AxiosError) => {
            const errorMessage =
                (error.response?.data as { message: string })?.message ||
                "Invalid Credentials";
            setServerError(errorMessage);
        }
    })

    const onSubmit = (data: FormData) => {
        loginMutation.mutate(data);
    }

    return (
        <div className='w-full py-10 min-h-[85vh] bg-[#f1f1f1]'>
            <h1 className='text-4xl font-Poppins font-semibold text-black text-center'>
                Login
            </h1>
            <p className='text-center text-lg font-medium py-3 text-[#00000099]'>
                Home . Login
            </p>
            <div className='w-full flex justify-center'>
                <div className='md:w-[480px] p-8 bg-white shadow rounded-lg'>
                    <h3 className='text-2xl font-semibold text-center mb-2'>
                        Login to Eshop
                    </h3>
                    <p className='text-center text-gray-500 mb-4'>
                        Don't have an account? {" "}
                        <Link href={'/signup'} className='text-blue-500'>
                            Sign up
                        </Link>
                    </p>
                    <GoogleButton />
                    <div className='flex items-center my-5 text-gray-500 text-sm'>
                        <div className='flex-1 border-t border-gray-300' />
                        <span className='px-3'>or Sign in with Email</span>
                        <div className='flex-1 border-t border-gray-300' />

                    </div>

                    <form onSubmit={handleSubmit(onSubmit)}>
                        <label className='block text-gray-700 mb-1'>Email</label>
                        <input type="email" placeholder='name@gmail.com'
                            className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                            {...register("email", {
                                required: "Email is required",
                                pattern: {
                                    value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
                                    message: "Please enter a valid email address"
                                }
                            })}
                        />

                        {errors.email && (
                            <p className='text-red-500 text-sm'>
                                {String(errors.email?.message)}
                            </p>

                        )}
                        <label className='block text-gray-700 mb-1'>Password</label>
                        <div className="relative">
                            <input
                                type={passwordVisible ? "text" : "password"}
                                placeholder='Min 6 characters'
                                className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                                {...register("password", {
                                    required: "Password is required",
                                    minLength: {
                                        value: 6,
                                        message: "Password must be at least 6 characters"
                                    }
                                })}
                            />
                            <button type="button"
                                onClick={() => setPasswordVisible(!passwordVisible)}
                                className="absolute inset-y-0 right-4 flex items-center text-gray-400"
                            >
                                {passwordVisible ? <Eye /> : <EyeOff />}
                            </button>


                        </div>
                        {errors.password && (
                            <p className='text-red-500 text-sm'>
                                {String(errors.password?.message)}
                            </p>

                        )}
                        <div className='flex justify-between items-center my-4'>
                            <label className='flex items-center text-gray-600'>
                                <input
                                    type="checkbox"
                                    className='mr-2'
                                    checked={rememberMe}
                                    onChange={() => setRememberMe(!rememberMe)}
                                />
                                Remember me
                            </label>
                            <Link href={'/forgot-password'} className='text-blue-500 hover:underline'>
                                Forgot password?
                            </Link>
                        </div>
                        <button
                            type="submit"
                            disabled={loginMutation.isPending}
                            className='w-full py-2 text-white bg-blue-500 rounded hover:bg-blue-600'>
                            {loginMutation.isPending ? <Loader2 className='animate-spin inline' /> : "Login"}
                        </button>

                        {serverError && (
                            <p className='text-red-500 text-sm mt-4'>
                                {serverError}
                            </p>
                        )}
                    </form>
                </div>
            </div>
        </div>
    )
}

export default Login