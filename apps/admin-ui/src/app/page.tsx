"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Input from "packages/components/input";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import axios, { AxiosError } from "axios";
type FormData = {
  email: string;
  password: string;
};

const page = () => {
  const { register, handleSubmit } = useForm<FormData>();
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const loginMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/login-admin`,
        data,
        { withCredentials: true },
      );

      return response.data;
    },
    onSuccess: (data) => {
      setServerError(null);
      router.push("/dashboard");
    },
    onError: (error: AxiosError) => {
      const errorMessage =
        (error.response?.data as { message?: string })?.message ||
        "Invalid credentials!";
      setServerError(errorMessage);
    },
  });

  const onSubmit = (data: FormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="w-full h-screen flex items-center justify-center">
      <div className="md:w-[450px] pb-8 bg-slate-800 rounded-md shadow">
        <form className="p-5" onSubmit={handleSubmit(onSubmit)}>
          <h1 className="text-3xl mb-3 pt-4 font-semibold text-center text-white font-Poppins">
            Welcome Admin
          </h1>
          <Input
            label="Email"
            placeholder="Enter your email"
            type="email"
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Invalid email address",
              },
            })}
          />
          <Input
            label="Password"
            placeholder="Enter your password"
            type="password"
            {...register("password", { required: "Password is required" })}
          />

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-Poppins py-2 px-4 rounded mt-4 cursor-pointer"
          >
            {loginMutation.isPending ? 
              <div className="h-6 w-6 border-2 border-gray-100 border-t-transparent rounded-full animate-spin" />
            : "Login"}
          </button>

          {serverError && <p className="text-red-500 mt-2">{serverError}</p>}
        </form>
      </div>
    </div>
  );
};

export default page;
