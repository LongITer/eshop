"use client";

import axiosInstance from "@/utils/axioInstance";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

type PasswordForm = { currentPassword: string; newPassword: string; confirmPassword: string };

const ChangePassword = () => {
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PasswordForm>();
  const mutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: PasswordForm) => (await axiosInstance.patch("/api/change-password", { currentPassword, newPassword })).data,
    onSuccess: () => { reset(); toast.success("Password changed successfully!"); },
    onError: (error: any) => toast.error(error.response?.data?.message ?? "Unable to change password."),
  });
  const passwordField = (name: keyof PasswordForm, label: string, validation: object) => <div><label className="mb-1 block text-sm font-medium text-gray-700" htmlFor={name}>{label}</label><div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input id={name} type={visible[name] ? "text" : "password"} {...register(name, validation)} className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><button type="button" onClick={() => setVisible((current) => ({ ...current, [name]: !current[name] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label={`Toggle ${label}`}>{visible[name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>{errors[name] && <p className="mt-1 text-xs text-red-500">{errors[name]?.message as string}</p>}</div>;
  return <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="max-w-md space-y-4">{passwordField("currentPassword", "Current password", { required: "Current password is required" })}{passwordField("newPassword", "New password", { required: "New password is required", minLength: { value: 8, message: "Use at least 8 characters" } })}{passwordField("confirmPassword", "Confirm new password", { required: "Please confirm your new password", validate: (value: string) => value === watch("newPassword") || "Passwords do not match" })}<button type="submit" disabled={mutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Update password</button></form>;
};

export default ChangePassword;