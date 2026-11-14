'use client';
import { useStorefrontText } from '@packages/components/storefront-language';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/utils/axioInstance';
import useUser from '@/hooks/useUser';
import { HeaderMessageButton } from './header-chat';
import { HeaderNotificationButton } from './header-notifications';

export function NotificationBadge() {
  const { user } = useUser();
  return user ? <><HeaderMessageButton userId={user.id} /><HeaderNotificationButton userId={user.id} /></> : null;
}
export function ProfileEditor({ user }: { user: any }) {
  const { t } = useStorefrontText();
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  return <form onSubmit={e => { e.preventDefault(); save.mutate(); }} className="space-y-4">
    <label className="block">{t("Name")}<input className="block border rounded p-3 w-full mt-1" value={name} required maxLength={100} onChange={e => setName(e.target.value)} /></label>
    <div>
      <span className="block mb-1">Email</span>
      <p className="p-3 bg-gray-50 border rounded text-gray-500">{user.email}</p>
    </div>
    <div className="block">
      <span className="block mb-2">{t("Avatar")}</span>
      <div className="flex items-center gap-4">
        {(previewUrl || user.avatar) ? (
          <img src={previewUrl || user.avatar} alt={t("Avatar preview")} className="w-20 h-20 rounded-full object-cover border border-gray-200" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
            <span className="text-gray-400 text-xs">{t("No image")}</span>
          </div>
        )}
        <input className="block" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => {
          const selectedFile = e.target.files?.[0] ?? null;
          setFile(selectedFile);
          if (selectedFile) {
            setPreviewUrl(URL.createObjectURL(selectedFile));
          } else {
            setPreviewUrl(null);
          }
        }} />
      </div>
    </div>
    <button disabled={save.isPending} className="bg-blue-600 text-white px-5 py-3 rounded mt-2">{save.isPending ? t('Saving…') : t('Save profile')}</button>
    {save.isSuccess && <p role="status" className="text-green-600">{t("Profile saved.")}</p>}
    {save.isError && <p role="alert" className="text-red-600">{t("Unable to save profile. Check the name and image size (maximum 5 MB).")}</p>}
    <Link className="block text-blue-600 mt-4" href="/profile/following">{t("Following shops")}</Link>
  </form>;
}
export function FollowButton({ shopId }: { shopId: string }) {
  const { t } = useStorefrontText();
  const { user } = useUser();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['followed-shops'], queryFn: async () => (await axios.get('/api/followed-shops')).data.shops, enabled: !!user });
  const following = query.data?.some((shop: any) => shop.id === shopId);
  const toggle = useMutation({ mutationFn: () => following ? axios.delete(`/api/unfollow-shop/${shopId}`) : axios.post(`/api/follow-shop/${shopId}`), onSuccess: () => client.invalidateQueries({ queryKey: ['followed-shops'] }) });
  if (!user) return <Link href="/login">{t("Sign in to follow")}</Link>;
  return <div><button disabled={toggle.isPending || query.isLoading || query.isError} onClick={() => toggle.mutate()} className="border rounded-lg px-5 py-3">{following ? t('Unfollow shop') : t('Follow shop')}</button>{(toggle.isError || query.isError) && <p role="alert">{t("Unable to update following. Please retry.")}</p>}</div>;
}
export function FollowedShops() {
  const { t } = useStorefrontText();
  const query = useQuery({ queryKey: ['followed-shops'], queryFn: async () => (await axios.get('/api/followed-shops')).data.shops });
  if (query.isLoading) return <p>{t("Loading shops…")}</p>;
  if (query.isError) return <p role="alert">{t("Unable to load shops. Please sign in or retry.")}</p>;
  return <div className="grid sm:grid-cols-2 gap-4">{!query.data.length && <p>{t("You are not following any shops.")}</p>}{query.data.map((shop: any) => <article className="border rounded-xl p-4" key={shop.id}><Link className="font-semibold text-blue-600" href={`/shop/${shop.id}`}>{shop.name}</Link><p>{shop.bio}</p><FollowButton shopId={shop.id} /></article>)}</div>;
}
