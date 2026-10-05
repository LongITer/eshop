'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/utils/axioInstance';
import useUser from '@/hooks/useUser';
import { UnreadMessages } from '@packages/components/chat';

export function NotificationBadge() {
  const { user } = useUser();
  const { data } = useQuery({ queryKey: ['user-notifications', 'badge'], queryFn: async () => (await axios.get('/api/user-notifications?limit=1')).data, enabled: !!user, refetchInterval: 30000 });
  return user ? <><UnreadMessages api={axios} href="/inbox" /><Link href="/notifications" aria-label={`Notifications: ${data?.unreadCount ?? 0} unread`} className="relative p-3"><Bell size={22} />{!!data?.unreadCount && <span className="absolute right-0 top-0 rounded-full bg-red-600 px-1 text-xs text-white">{data.unreadCount}</span>}</Link></> : null;
}
export function ProfileEditor({ user }: { user: any }) {
  const [name, setName] = useState(user.name);
  const [file, setFile] = useState<File | null>(null);
  const client = useQueryClient();
  const save = useMutation({ mutationFn: async () => {
    let avatar;
    if (file) {
      const encoded = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      avatar = (await axios.post('/api/upload-account-image', { file: encoded })).data;
    }
    return axios.put('/api/update-user', { name, avatar });
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['user'] }) });
  return <form onSubmit={e => { e.preventDefault(); save.mutate(); }} className="space-y-4"><label className="block">Name<input className="block border rounded p-3 w-full" value={name} required maxLength={100} onChange={e => setName(e.target.value)} /></label><p>{user.email}</p><label className="block">Avatar<input className="block py-2" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label><button disabled={save.isPending} className="bg-blue-600 text-white px-5 py-3 rounded">{save.isPending ? 'Saving…' : 'Save profile'}</button>{save.isSuccess && <p role="status">Profile saved.</p>}{save.isError && <p role="alert">Unable to save profile. Check the name and image size (maximum 5 MB).</p>}<Link className="block text-blue-600" href="/profile/following">Following shops</Link></form>;
}
export function FollowButton({ shopId }: { shopId: string }) {
  const { user } = useUser();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['followed-shops'], queryFn: async () => (await axios.get('/api/followed-shops')).data.shops, enabled: !!user });
  const following = query.data?.some((shop: any) => shop.id === shopId);
  const toggle = useMutation({ mutationFn: () => following ? axios.delete(`/api/unfollow-shop/${shopId}`) : axios.post(`/api/follow-shop/${shopId}`), onSuccess: () => client.invalidateQueries({ queryKey: ['followed-shops'] }) });
  if (!user) return <Link href="/login">Sign in to follow</Link>;
  return <div><button disabled={toggle.isPending || query.isLoading || query.isError} onClick={() => toggle.mutate()} className="border rounded-lg px-5 py-3">{following ? 'Unfollow shop' : 'Follow shop'}</button>{(toggle.isError || query.isError) && <p role="alert">Unable to update following. Please retry.</p>}</div>;
}
export function FollowedShops() {
  const query = useQuery({ queryKey: ['followed-shops'], queryFn: async () => (await axios.get('/api/followed-shops')).data.shops });
  if (query.isLoading) return <p>Loading shops…</p>;
  if (query.isError) return <p role="alert">Unable to load shops. Please sign in or retry.</p>;
  return <div className="grid sm:grid-cols-2 gap-4">{!query.data.length && <p>You are not following any shops.</p>}{query.data.map((shop: any) => <article className="border rounded-xl p-4" key={shop.id}><Link className="font-semibold text-blue-600" href={`/shop/${shop.id}`}>{shop.name}</Link><p>{shop.bio}</p><FollowButton shopId={shop.id} /></article>)}</div>;
}
