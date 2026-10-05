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
import axiosInstance from "@/utils/axioInstance";
import isProtected from "@/utils/protected";

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
  const [isLoading, setIsLoading] = useState(false);


  const { user } = useUser();
  const location = useLocationTracking();
  const deviceInfo = useDeviceTracking();
  const addtoWishlist = useStore((state: any) => state.addToWishlist);
  const addToCart = useStore((state: any) => state.addToCart);
  const removeFromWishlist = useStore((state: any) => state.removeFromWishlist);
  const wishlist = useStore((state: any) => state.wishlist);
  const isWishlisted = wishlist.some((item: any) => item.id === data.id);
  const cart = useStore((state: any) => state.cart);
  const isInCart = cart.some((item: any) => item.id === data.id);

  const estimatedDelivery = new Date();
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);

  const router = useRouter();

  const handleChat = async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const res = await axiosInstance.post(
        "/chatting/api/create-user-conversationGroup",
        { sellerId: data?.shop?.sellerId },
        isProtected,
      );
      router.push(`/inbox?conversationId=${res.data?.conversationId}`);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm md:p-6"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative grid max-h-[calc(100vh-24px)] w-full max-w-6xl grid-cols-1 overflow-y-auto rounded-xl bg-white shadow-2xl md:max-h-[calc(100vh-48px)] md:grid-cols-2"
        onClick={(e) => e.stopPropagation()}
      >
        <section className="bg-slate-50 p-4 md:p-7">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
            <Image
              src={data?.images?.[activeImage]?.url || "/default-image.jpg"}
              alt={data?.title || "Product image"}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain p-5 md:p-8"
            />
            <span className="absolute bottom-3 right-3 rounded bg-white/90 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm">
              {activeImage + 1} / {data?.images?.length || 1}
            </span>
          </div>

          {data?.images?.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {data.images.map((img: any, index: number) => (
                <button
                  key={img.id || img.url || index}
                  type="button"
                  aria-label={`View product image ${index + 1}`}
                  aria-pressed={activeImage === index}
                  className={`h-[76px] w-[76px] shrink-0 overflow-hidden rounded-md border bg-white p-1 transition ${activeImage === index ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-400"}`}
                  onClick={() => setActiveImage(index)}
                >
                  <Image
                    src={img.url || "/default-image.jpg"}
                    alt={`${data?.title || "Product"} image ${index + 1}`}
                    width={68}
                    height={68}
                    className="h-full w-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}

        </section>

        <section className="relative p-5 pt-14 md:p-8 md:pt-8">
          <button
            type="button"
            aria-label="Close product preview"
            className="absolute right-4 top-4 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:right-6 md:top-6"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
            {/* Seller Information */}
            <div className="border-b border-gray-300 pb-4 flex items-center justify-between gap-4">
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
                className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                onClick={() => handleChat()}
                disabled={isLoading}
              >
                <MessageCircle size={16} />
                {isLoading ? "Opening..." : "Chat with Seller"}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {data?.category && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {data.category}
                </span>
              )}
              {data?.subCategory && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  {data.subCategory}
                </span>
              )}
            </div>

            <h3 className="mt-3 text-2xl font-semibold leading-tight text-slate-900">
              {data?.title}
            </h3>
            {data?.short_description && (
              <p className="mt-3 rounded-md border-l-2 border-blue-500 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                {data.short_description}
              </p>
            )}

            {/* Brand */}
            {data?.brand && (
              <p className="mt-4 text-sm text-slate-700">
                <strong className="text-slate-900">Brand:</strong> {data.brand}
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
            <div className="mt-5 border-t border-slate-200 pt-1">
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
        </section>
      </div>
    </div>
  );
};

export default ProductDetailsCard;
