import ProductDetails from "@/shared/modules/product/product-detail";
import axiosInstance from "@/utils/axioInstance";
import { Metadata } from "next";
import React from "react";

async function fetchProductDetails(slug: string) {
  const response = await axiosInstance.get(`/product/api/get-product/${slug}`);
  return response.data.product;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductDetails(slug);
  return {
    title: `${product.title} | Becodemy Marketplace`,
    description:
      product?.short_description ||
      "Discover high-quality products on Becodemy Marketplace.",
    openGraph: {
      title: product.title,
      description:
        product?.short_description ||
        "Discover high-quality products on Becodemy Marketplace",
      images: [product?.images?.[0]?.url || "/default-image.jpg"],
      type: "website",
    },
  };
}

const page = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const productDetails = await fetchProductDetails(slug);
  console.log(productDetails);
  return <ProductDetails productDetails={productDetails} />;
};

export default page;
