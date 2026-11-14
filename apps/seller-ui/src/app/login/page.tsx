'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { ArrowRight, ChartNoAxesCombined, Eye, EyeOff, Loader2, Package, ShoppingBag, Store } from 'lucide-react';

type Credentials = { email: string; password: string };
export default function SellerLogin() {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const client = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<Credentials>();
  const login = useMutation({
    mutationFn: async (credentials: Credentials) => axios.post('/api/login-seller', { ...credentials, email: credentials.email.trim() }, { withCredentials: true }),
    onSuccess: () => { setError(null); client.clear(); router.replace('/dashboard'); },
    onError: (failure: AxiosError<{ message?: string }>) => setError(failure.response?.data?.message || 'Unable to sign in. Please check your connection and try again.'),
  });
  return <main className="flex min-h-screen items-center justify-center bg-[#080d1a] px-4 py-8 text-slate-100 sm:p-8">
    <div className="w-full max-w-[1060px] overflow-hidden rounded-3xl border border-slate-800 bg-[#0b1120] shadow-2xl shadow-black/30 lg:grid lg:grid-cols-[1.04fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-slate-800 bg-slate-900/50 p-12 lg:flex lg:flex-col"><div className="pointer-events-none absolute -left-20 -top-40 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" /><Link href="/login" className="relative inline-flex items-center gap-2.5"><span className="rounded-xl bg-blue-600 p-2.5"><ShoppingBag size={20} /></span><span className="text-2xl font-bold tracking-tight">eshop<span className="text-blue-400">.</span></span><span className="ml-2 rounded border border-slate-700 px-2 py-1 text-[9px] tracking-widest text-slate-400">SELLER</span></Link><div className="relative my-auto py-16"><p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-400">Seller center</p><h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight">A better day<br />for your business.</h1><p className="mt-5 max-w-xs text-sm leading-7 text-slate-400">Everything you need to manage your Eshop store, from your next listing to your latest order.</p><div className="mt-9 space-y-5">{[{ Icon: Package, title: 'Keep your catalog in shape', note: 'Products, variants and stock in one place.' }, { Icon: ShoppingBag, title: 'Stay on top of every order', note: 'Follow fulfillment from purchase to delivery.' }, { Icon: ChartNoAxesCombined, title: 'Understand your sales', note: 'Revenue and product reports for your store.' }].map(({ Icon, title, note }) => <div key={title} className="flex items-start gap-3"><span className="rounded-lg border border-slate-700/60 bg-slate-800/60 p-2 text-blue-400"><Icon size={17} /></span><div><p className="text-xs font-medium text-slate-200">{title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{note}</p></div></div>)}</div></div><p className="relative text-[11px] text-slate-600">Eshop · Your store, connected.</p></section>
      <section className="px-6 py-10 sm:px-10 sm:py-14 lg:px-12 lg:py-16"><span className="mb-7 inline-flex rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-blue-400"><Store size={24} strokeWidth={1.5} /></span><p className="text-xs font-medium uppercase tracking-[.16em] text-slate-500">Welcome back</p><h2 className="mt-3 text-2xl font-semibold tracking-tight">Sign in to your store</h2><p className="mt-3 text-sm leading-6 text-slate-400">Use the email address registered to your seller account.</p><form className="mt-8 space-y-5" onSubmit={handleSubmit(value => login.mutate(value))}>
        <div><label htmlFor="seller-email" className="mb-2 block text-xs font-medium text-slate-300">Email address</label><input id="seller-email" type="email" autoComplete="username" className="seller-input" placeholder="you@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'seller-email-error' : undefined} {...register('email', { required: 'Enter your email address.', validate: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || 'Enter a valid email address.' })} />{errors.email && <p id="seller-email-error" className="mt-2 text-xs text-rose-400">{errors.email.message}</p>}</div>
        <div><label htmlFor="seller-password" className="mb-2 block text-xs font-medium text-slate-300">Password</label><div className="relative"><input id="seller-password" type={visible ? 'text' : 'password'} autoComplete="current-password" className="seller-input pr-12" placeholder="Enter your password" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'seller-password-error' : undefined} {...register('password', { required: 'Enter your password.' })} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-200">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{errors.password && <p id="seller-password-error" className="mt-2 text-xs text-rose-400">{errors.password.message}</p>}</div>
        {error && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs leading-6 text-rose-300">{error}</p>}
        <button type="submit" disabled={login.isPending} className="seller-button w-full bg-blue-600 text-white shadow-lg shadow-blue-950/40 hover:bg-blue-500">{login.isPending ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}{login.isPending ? 'Signing in…' : 'Sign in'}</button>
      </form><p className="mt-7 text-center text-xs leading-6 text-slate-500">New to Eshop? <Link href="/signup" className="ml-1 font-medium text-blue-400 hover:text-blue-300">Create a seller account</Link></p><div className="mt-9 border-t border-slate-800 pt-6 text-center text-[11px] leading-6 text-slate-600">Catalog, orders and revenue. One seller workspace.</div></section>
    </div>
  </main>;
}
