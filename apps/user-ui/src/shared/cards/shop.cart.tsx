import Image from "next/image";
import React from "react";

interface ShopCardProps {
  shop: {
    id: string;
    name: string;
    description?: string;
    avatar: string;
    coverBanner?: string;
    address?: string;
    followers?: [];
    rating?: number;
    category?: string;
  };
}

const ShopCard: React.FC<ShopCardProps> = ({ shop }) => {
  return (
    <div className="w-full rounded-full cursor-pointer bg-white border border-gray-200 shadow-sm overflow-hidden transition">
      {/* Cover */}
      <Image
        src={
          shop?.coverBanner ||
          "https://cdn-media.sforum.vn/storage/app/media/ctvseo_maihue/hinh-nen-1920-1080/hinh-nen-1920-1080-thumbnail.jpg"
        }
        alt="Cover"
        width={500}
        height={500}
        className="object-cover w-full h-full"
      />
    </div>
  );
};

export default ShopCard;
