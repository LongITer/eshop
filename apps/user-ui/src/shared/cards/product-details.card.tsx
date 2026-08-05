import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";
import Ratings from "../ratings";
import { Heart, MapPin, MessageCircle, ShoppingCart, X } from "lucide-react";
import { useRouter } from "next/navigation";
import useUser from "../../hooks/useUser";
import useLocationTracking from "../../hooks/useLocationTracking";
import useDeviceTracking from "../../hooks/useDeviceTracking";
import { useStore } from "../../store";

const ProductDetailsCard = ({
  data,
  setOpen,
}: {
  data: any;
  setOpen: (open: boolean) => void;
}) => {
  const [activeImage, setActiveImage] = useState(0);
  const [isSelected, setIsSelected] = useState(data?.colors?.[0] || "");
  const [isSizeSelected, setIsSizeSelected] = useState(data?.sizes?.[0] || "");
  const [quantity, setQuantity] = useState(1);

  const [timeLeft, setTimeLeft] = useState("");

  const user = useUser();
  const location = useLocationTracking();
  const deviceInfo = useDeviceTracking();
  const addtoWishlist = useStore((state: any) => state.addToWishlist);
  const addToCart = useStore((state: any) => state.addToCart);
  const removeFromCart = useStore((state: any) => state.removeFromCart);
  const removeFromWishlist = useStore((state: any) => state.removeFromWishlist);
  const wishlist = useStore((state: any) => state.wishlist);
  const isWishlisted = wishlist.some((item: any) => item.id === data.id);
  const cart = useStore((state: any) => state.cart);
  const isInCart = cart.some((item: any) => item.id === data.id);

  const estimatedDelivery = new Date();
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);

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

              <button className="w-full absolute cursor-pointer right-[-5px] top-[-5px] flex justify-end my-2 mt-[-10px]">
                <X size={20} onClick={() => setOpen(false)} />
              </button>
            </div>

            <h3 className="text-xl font-semibold mt-3">{data?.title}</h3>
            <p className="mt-2 text-gray-700 whitespace-pre-wrap w-full">
              {data?.short_description}{" "}
            </p>

            {/* Brand */}
            {data?.brand && (
              <p className="mt-2">
                <strong>Brand: </strong> {data.brand}
              </p>
            )}
            {/* Color & Size Selection */}
            <div className="flex flex-col md:flex-row  items-start gap-5 mt-4">
              {/* Color Option */}
              {data?.colors?.length > 0 && (
                <div>
                  <strong>Color: </strong>
                  <div className="flex gap-2 mt-1">
                    {data?.colors?.map((color: string, index: number) => (
                      <button
                        key={index}
                        className={`w-8 h-8 cursor-pointer rounded-full border-2 ${isSelected === color ? "border-blue-500" : "border-transparent"}`}
                        onClick={() => setIsSelected(color)}
                        style={{ backgroundColor: color }}
                      ></button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Options */}
              {data?.sizes?.length > 0 && (
                <div>
                  <strong>Size: </strong>
                  <div className="flex gap-2 mt-1">
                    {data?.sizes.map((size: string, index: number) => (
                      <button
                        key={index}
                        className={`px-4 py-1 cursor-pointer rounded-md transition-all
                                ${isSizeSelected === size ? "bg-gray-800 text-white" : "bg-gray-300 text-black"}`}
                        onClick={() => setIsSizeSelected(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              {/* Price section */}
              <div className="mt-5 flex items-center gap-4">
                <h3 className="text-2xl font-semibold text-gray-900">
                  ${data?.sale_price}
                </h3>
                {data?.regular_price && (
                  <h3 className="text-lg text-red-600 line-through">
                    ${data.regular_price}
                  </h3>
                )}
              </div>
              <div className="mt-5 flex items-center gap-5">
                <div className="flex items-center rounded-md">
                  <button
                    className="px-3 cursor-pointer py-1 bg-gray-300 hover:bg-gray-400 text-black font-semibold rounded-l-md"
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  >
                    -
                  </button>

                  <span className="px-3 cursor-pointer py-1 bg-gray-300 text-black font-semibold">
                    {quantity}
                  </span>

                  <button
                    className="px-3 cursor-pointer py-1 bg-gray-300 hover:bg-gray-400 text-black font-semibold rounded-r-md"
                    onClick={() => setQuantity((prev) => prev + 1)}
                  >
                    +
                  </button>
                </div>

                <button
                  disabled={isInCart}
                  onClick={() =>
                    addToCart(
                      {
                        ...data,
                        quantity,
                        selectedOptions: {
                          color: isSelected,
                          size: isSizeSelected,
                        },
                      },
                      user,
                      location,
                      deviceInfo,
                    )
                  }
                  className={`flex items-center gap-2 px-4 py-2 bg-[#ff5722] hover:bg-[#e64a19] text-white font-medium rounded-lg transition ${isInCart ? "cursor-not-allowed opacity-70" : "cursor-pointer"} `}
                >
                  <ShoppingCart size={18} />
                  {isInCart ? "In Cart" : "Add to Cart"}
                </button>

                <button
                  className="cursor-pointer"
                  onClick={() =>
                    isWishlisted
                      ? removeFromWishlist(data.id, user, location, deviceInfo)
                      : addtoWishlist(
                          { ...data, quantity: 1 },
                          user,
                          location,
                          deviceInfo,
                        )
                  }
                >
                  <Heart
                    size={30}
                    fill={isWishlisted ? "red" : "none"}
                    stroke={isWishlisted ? "red" : "#4b5563"}
                    className="hover:scale-110 transition"
                  />
                </button>
              </div>
              <div className="mt-3">
                {data.stock > 0 ? (
                  <span className="text-green-600 font-semibold">In Stock</span>
                ) : (
                  <span className="text-red-600 font-semibold">
                    Out of Stock
                  </span>
                )}
              </div>{" "}
              <div className="mt-3 text-gray-600 text-sm">
                Estimated delivery :{" "}
                <strong>{estimatedDelivery.toDateString()}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsCard;
