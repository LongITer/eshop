import { ArrowUpRight, MapPin, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
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

        {/* Address + Ratings */}
        <div className="flex items-center justify-center text-xs text-gray-500 mt-2 gap-4 flex-wrap">
          {shop.address && (
            <span className="flex items-center gap-1 max-w-[120px]">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{shop.address}</span>
            </span>
          )}

          <span className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            {shop.rating ?? "5/5"}
          </span>
        </div>

        {/* Category */}
        {shop?.category && (
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
            <span className="bg-blue-50 capitalize text-blue-600 px-2 py-0.5 rounded">
              {shop.category}
            </span>
          </div>
        )}

        {/* Visit Button */}
        <div className="mt-4">
          <Link
            href={`/shop/${shop.id}`}
            className="inline-flex items-center text-sm text-blue-600 font-medium hover:underline"
          >
            Visit Shop
            <ArrowUpRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ShopCard;
