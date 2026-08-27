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

      {/* Shop Avatar */}
      <div className="relative flex justify-center -mt-8">
        <div className="w-16 h-16 rounded-full border-4 border-white overflow-hidden">
          <Image
            src={
              shop.avatar ||
              "https://png.pngtree.com/png-vector/20191101/ourmid/pngtree-cartoon-color-simple-male-avatar-png-image_1934459.jpg"
            }
            alt={shop.name}
            width={64}
            height={64}
            className="object-cover"
          />
        </div>
      </div>
    </div>
  );
};

export default ShopCard;
