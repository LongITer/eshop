import SellerProfile from "@/shared/modules/seller/seller-profile";
import axios from "@/utils/axioInstance";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
const fetchShop = cache(async (id: string) => {
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  try { return (await axios.get(`/product/api/get-shop/${id}`)).data; }
  catch (error: any) { if (error.response?.status === 404) notFound(); throw error; }
});
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  let data;
  try {
    data = await fetchShop(id);
  } catch {
    // Leave route errors to ShopPage rather than metadata streaming.
    return { title: "Shop | Eshop", robots: { index: false, follow: false } };
  }
  const { shop } = data;
  if (!shop) return { title: "Shop not found | Eshop", robots: { index: false, follow: false } };
  const title = `${shop.name} | Eshop`;
  const description = shop.bio || `Shop products from ${shop.name} on Eshop.`;
  const url = `/shop/${id}`;
  const image = shop.coverBanner || shop.avatar?.[0]?.url;
  const images = image ? [image] : [];
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, images, type: 'website' }, twitter: { card: 'summary_large_image', title, description, images } };
}
export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await fetchShop((await params).id);
  if (!data.shop) notFound();
  return <SellerProfile sellerData={data} />;
}
