import SellerProfile from "@/shared/modules/seller/seller-profile";
import axiosInstance from "@/utils/axioInstance";
import { Metadata } from "next";

async function fetchSellerDetails(id: string) {
  try {
    const response = await axiosInstance.get(`/product/api/get-shop/${id}`);
    // Strip non-serializable objects (AxiosHeaders, etc.) before passing to Client Component
    return JSON.parse(JSON.stringify(response.data));
  } catch (error) {
    console.error("Failed to fetch seller details:", error);
    return null;
  }
}

// Dynamic metadata generator
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const data = await fetchSellerDetails(params.id);

  return {
    title: `${data?.shop?.name || "Eshop Marketplace"}`,
    description: `${data?.shop?.bio || "Check out amazing products from this seller"}`,
    icons: {
      icon: data?.shop?.logoUrl,
    },
    openGraph: {
      title: data?.shop?.name,
      description:
        data?.shop?.bio || "Check out amazing products from this seller",
      type: "website",
      images: [
        {
          url: data?.shop?.avatar || "/default.png",
          width: 800,
          height: 600,
          alt: data?.shop?.name || "Shop Logo",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: data?.shop?.name,
      description:
        data?.shop?.bio || "Check out amazing products from this seller",
      images: [
        {
          url: data?.shop?.logoUrl,
          width: 800,
          height: 600,
          alt: data?.shop?.name,
        },
      ],
    },
  };
}

const ShopIdPage = async ({ params }: { params: { id: string } }) => {
  const sellerData = await fetchSellerDetails(params.id);
  return <SellerProfile sellerData={sellerData} />;
};

export default ShopIdPage;
