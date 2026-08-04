import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";
import Ratings from "../ratings";
import { MapPin, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";

const ProductDetailsCard = ({
  data,
  setOpen,
}: {
  data: any;
  setOpen: (open: boolean) => void;
}) => {
  const [activeImage, setActiveImage] = useState(0);
  const router = useRouter();
  return (
    <div
      className="fixed flex items-center justify-center top-0 left-0 h-screen w-full bg-[#0000001d] z-50"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[90%] md:w-[70%] md:mt-14 2xl:mt-o h-max overflow-scroll min-h-[70vh] p-4 md:p-6 bg-white shadow-md rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex flex-col md:flex-row">
          <div className="w-full md:w-1/2 h-full">
            <Image
              src={data?.images?.[activeImage]?.url}
              alt={data?.images?.[activeImage].url}
              width={400}
              height={400}
              className="w-full rounded-lg object-contain"
            />

            {/* Thumbnail */}
            <div className="flex gap-2 mt-4">
              {data?.images?.map((img: any, index: number) => (
                <div
                  key={index}
                  className={`cursor-pointer border rounded-md ${activeImage === index ? "border-gray-500 pt-1" : "border-transparent"}`}
                  onClick={() => setActiveImage(index)}
                >
                  <Image
                    src={img.url}
                    alt={img.url}
                    width={100}
                    height={100}
                    className="w-full h-[80px] object-cover rounded-md"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-1/2 md:pl-8 mt-6 md:mt-0">
            {/* Seller Information */}
            <div className="border-b relative pb-3 border-gray-300 flex items-center justify-between">
              <div className="flex items-start gap-3">
                {/* Shop Logo */}
                {data?.shop?.avatar ? (
                  <Image
                    src={data.shop.avatar}
                    alt="Shop Logo"
                    width={60}
                    height={60}
                    className="w-[50px] h-[50px] rounded-full object-cover"
                  />
                ) : (
                  <div className="w-[50px] h-[50px] rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-lg">
                    {data?.shop?.name?.[0]?.toUpperCase() || "S"}
                  </div>
                )}

                <div>
                  <Link
                    href={`/shop/${data?.shop?.id}`}
                    className="text-lg font-semibold"
                  >
                    {data?.shop?.name}
                  </Link>

                  <span className="block mt-1 ">
                    <Ratings rating={data?.shop?.ratings} />
                  </span>

                  {/* Shop location */}
                  <p className="text-gray-600 mt-1 flex  items-center">
                    <MapPin size={20} />{" "}
                    {data?.shop?.address || "Location not available"}
                  </p>
                </div>
              </div>

              {/* Chat with seller button*/}
                <button
                  className="flex cursor-pointer items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-medium rounded-full shadow-md hover:shadow-lg transition-all active:scale-95 whitespace-nowrap ml-auto"
                  onClick={() =>
                    router.push(
                      `/inbox?shopId=${data?.shop?._id}&userId=${data?.user?._id}`,
                    )
                  }
                >
                  <MessageCircle size={16} />
                  Chat with Seller
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsCard;
