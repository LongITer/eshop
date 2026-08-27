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
    <div className="w-full rounded-sm cursor-pointer bg-white border border-gray-200 shadow-sm transition">
      {/* Cover */}
      <Image
        src={
          shop.coverBanner ||
          "https://thiepmung.com/images/theme/ngam-va-tai-hinh-nen-dep-cho-may-tinh-556444149b46f6.jpg"
        }
        alt="Cover"
        width={400}
        height={400}
        className="object-cover w-full h-32"
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

      {/* Information */}
      <div className="px-4 pb-4 pt-2 text-center">
        <h3 className="text-base font-semibold text-gray-800">{shop.name}</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {shop?.followers?.length ?? 0} Followers
        </p>
      </div>
    </div>
  );
};

export default ShopCard;
