import ProductDetails from "@/shared/modules/product/product-detail";
import axios from "@/utils/axioInstance";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import ProductReviews from "@/shared/components/product-reviews";
import Recommendations from "@/shared/components/recommendations";

const fetchProduct = cache(async (slug: string) => {
  try { return (await axios.get(`/product/api/get-product/${encodeURIComponent(slug)}`)).data.product; }
  catch (error: any) { if (error.response?.status === 404) notFound(); throw error; }
});
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  let product;
  try {
    product = await fetchProduct(slug);
  } catch {
    // Metadata must resolve to serializable values even when the API fails.
    // ProductPage still handles the original error or not-found response.
    return { title: "Product | Eshop", robots: { index: false, follow: false } };
  }
  if (!product) return { title: "Product not found | Eshop", robots: { index: false, follow: false } };
  const title = `${product.title} | Eshop`;
  const description = product.short_description || `Explore ${product.title} on Eshop.`;
  const url = `/product/${encodeURIComponent(slug)}`;
  const images = product.images?.[0]?.url ? [product.images[0].url] : [];
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, images, type: "website" }, twitter: { card: "summary_large_image", title, description, images } };
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await fetchProduct((await params).slug);
  if (!product) notFound();
  return <><ProductDetails productDetails={product} /><ProductReviews productId={product.id} /><Recommendations productId={product.id} /></>;
}
