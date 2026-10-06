'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck, ShoppingBag } from 'lucide-react';
import { AxiosError } from 'axios';
import axiosInstance from '../utils/axioInstance';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const client = useQueryClient();
  const login = useMutation({
    mutationFn: () => axiosInstance.post('/api/login-admin', { email, password }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['admin'] }); router.push('/dashboard'); },
  });
  const error = (login.error as AxiosError<{ message?: string }>)?.response?.data?.message || 'Unable to sign in. Check your credentials and try again.';
  return <main className="grid min-h-screen lg:grid-cols-2">
    <section className="relative hidden flex-col justify-between overflow-hidden border-r border-gray-800 bg-[#0b1222] p-14 lg:flex">
      <div className="pointer-events-none absolute -left-48 top-36 h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-3xl" />
      <div className="relative flex items-center gap-3 text-2xl font-bold text-white"><span className="rounded-xl bg-blue-600 p-3"><ShoppingBag size={25} /></span>Eshop</div>
      <div className="relative max-w-lg"><span className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-400"><ShieldCheck size={14} /> Administrator workspace</span><h1 className="text-5xl font-semibold leading-[1.15] tracking-tight text-white">Your marketplace.<br /><span className="text-blue-400">The bigger picture.</span></h1><p className="mt-6 max-w-sm text-base leading-7 text-slate-400">Bring your orders, sellers and customers together. Everything you need to run your marketplace, in one place.</p><div className="mt-10 grid grid-cols-3 gap-4 border-t border-gray-800 pt-6">{['Track sales', 'Manage sellers', 'Grow together'].map(text => <span className="text-xs text-slate-500" key={text}>{text}</span>)}</div></div>
      <p className="relative text-xs text-slate-600">Eshop · Marketplace administration</p>
    </section>
    <section className="flex items-center justify-center p-6 sm:p-12"><div className="w-full max-w-sm"><div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400"><ShieldCheck size={24} /></div><p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-blue-400">Welcome back</p><h2 className="text-3xl font-semibold tracking-tight text-white">Sign in to Eshop</h2><p className="mt-3 text-sm leading-6 text-slate-400">Use your administrator account to continue.</p><form className="mt-8 space-y-5" onSubmit={event => { event.preventDefault(); login.mutate(); }}><label className="admin-label">Email address<input required autoComplete="username" type="email" className="admin-control" placeholder="admin@example.com" value={email} onChange={event => setEmail(event.target.value)} /></label><label className="admin-label">Password<span className="relative block"><input required autoComplete="current-password" type={visible ? 'text' : 'password'} className="admin-control !pr-12" placeholder="Enter your password" value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)} className="absolute right-3 top-3 text-slate-500 hover:text-white">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>{login.isError && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs leading-5 text-red-300">{error}</p>}<button disabled={login.isPending} className="admin-primary w-full !py-3">{login.isPending ? 'Signing in…' : 'Sign in'}<ArrowRight size={17} /></button></form><p className="mt-8 border-t border-gray-800 pt-6 text-xs leading-5 text-slate-500">Access is limited to authorized marketplace administrators.</p></div></section>
  </main>;
}
