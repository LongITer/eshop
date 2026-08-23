"use client";

import useDeviceTracking from "@/hooks/useDeviceTracking";
import useLocationTracking from "@/hooks/useLocationTracking";
import useUser from "@/hooks/useUser";
import ImageMagnifier from "@/shared/components/image-magnifier";
import Ratings from "@/shared/ratings";
import { useStore } from "@/store";
import { ChevronLeft, Heart, ShoppingCart } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

const ProductDetails = ({ productDetails }: { productDetails: any }) => {
  const mainImage = productDetails?.images?.[0]?.url || "/default-image.jpg";
  const [currentImage, setCurrentImage] = useState(
    productDetails?.images[0]?.url,
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  const { user, isLoading } = useUser();
  const location = useLocationTracking();
  const deviceInfo = useDeviceTracking();

  const [isSelectedColor, setIsSelectedColor] = useState(
    productDetails?.color?.[0] || "",
  );

  const [isSelectedSize, setIsSelectedSize] = useState(
    productDetails?.size?.[0] || "",
  );

  const [quantity, setQuantity] = useState(1);

  const [priceRange, setPriceRange] = useState([
    productDetails?.sale_price,
    1199,
  ]);

  const [recommendedProducts, setRecommendedProducts] = useState([]);

  const addToCart = useStore((state: any) => state.addToCart);
  const cart = useStore((state: any) => state.cart);
  const isInCart = cart.some((item: any) => item.id === productDetails.id);
  const addToWishlist = useStore((state: any) => state.addToWishlist);
  const removeFromWishlist = useStore((state: any) => state.removeFromWishlist);
  const wishlist = useStore((state: any) => state.wishlist);
  const isWishlisted = wishlist.some(
    (item: any) => item.id === productDetails.id,
  );

  const prevImage = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setCurrentImage(productDetails?.images[currentIndex - 1]?.url);
    }
  };

  const nextImage = () => {
    if (currentIndex < productDetails?.images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentImage(productDetails?.images[currentIndex + 1]?.url);
    }
  };

  const discountPercentage = Math.round(
    ((productDetails.regular_price - productDetails.sale_price) /
      productDetails.regular_price) *
      100,
  );

  return (
    <div className="w-full bg-[#f5f5f5] py-5 ">
      <div className="w-[90%] bg-white lg:w-[80%] mx-auto pt-6 grid grid-cols-1 lg:grid-cols-[28%_44%_28%] gap-6 overflow-hidden">
        {/* Left column */}
        <div className="p-4">
          <div className="relative w-full">
            {/* Main image with zoom */}
            <ImageMagnifier src={mainImage} alt={productDetails?.title} />
            {/* Thumbnail image */}
            <div className="relative flex items-center gap-2 mt-4 overflow-hidden">
              {productDetails?.images?.length > 4 && (
                <button
                  className="absolute left-0 bg-white rounded-full shadow-md z-10"
                  onClick={prevImage}
                  disabled={currentImage === 0}
                >
                  <ChevronLeft size={24} />
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Middle column - product details*/}
        <div className="p-4">
          {/* Title */}
          <h1 className="text-xl mb-2 font-medium">{productDetails.title}</h1>
          {/* Ratings and Reviews */}
          <div className="w-full flex items-center justify-between">
            <div className="flex gap-2 mt-2 text-yellow-500">
              <Ratings rating={productDetails?.rating} />
              <Link href={"#reviews"} className="text-blue-500 hover:underline">
                (0 review)
              </Link>
            </div>
            <div>
              <Heart
                size={20}
                fill={isWishlisted ? "red" : "none"}
                className="cursor-pointer"
                color={isWishlisted ? "transparent" : "black"}
                onClick={() => {
                  if (isWishlisted) {
                    removeFromWishlist(
                      productDetails.id,
                      user,
                      location,
                      deviceInfo,
                    );
                  } else {
                    addToWishlist(
                      {
                        ...productDetails,
                        quantity,
                        selectedOptions: {
                          color: isSelectedColor,
                          size: isSelectedSize,
                        },
                      },
                      user,
                      location,
                      deviceInfo,
                    );
                  }
                }}
              />
            </div>
          </div>

          <div className="py-2 border-b border-gray-200">
            <span className="text-gray-500">
              Brand:{" "}
              <span className="text-blue-500">
                {productDetails?.brand || "No brand"}
              </span>
            </span>
          </div>

          <div className="mt-3">
            <span className="text-3xl font-bold text-orange-500">
              ${productDetails?.sale_price}
            </span>
            <div className="flex gap-2 pb-2 text-lg border-b border-b-slate-200">
              <span className="text-gray-400 line-through">
                ${productDetails?.regular_price}
              </span>
              <span className="text-gray-500">-{discountPercentage}%</span>
            </div>

            <div className="mt-2">
              <div className="flex flex-col md:flex-row items-start gap-5 mt-4">
                {/* Color options */}
                {productDetails?.colors?.length > 0 && (
                  <div>
                    <strong>Color: </strong>
                    <div className="flex gap-2 mt-1">
                      {productDetails?.colors?.map(
                        (color: string, index: number) => (
                          <button
                            key={index}
                            className={`w-5 h-5 rounded-full border transition ${isSelectedColor === color ? "border-gray-400 scale-110 shadow-md" : "border-transparent"}`}
                            onClick={() => setIsSelectedColor(color)}
                            style={{ backgroundColor: color }}
                          />
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* Size options */}
                {productDetails?.sizes?.length > 0 && (
                  <div>
                    <strong>Size: </strong>
                    <div className="flex gap-2 mt-1">
                      {productDetails?.sizes?.map(
                        (size: string, index: number) => (
                          <button
                            key={index}
                            className={`min-w-[36px] px-2 py-1 text-xs font-semibold rounded border transition-all duration-200 ${
                              isSelectedSize === size
                                ? "bg-orange-500 text-white border-orange-500 shadow-md scale-105"
                                : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:border-gray-400"
                            }`}
                            onClick={() => setIsSelectedSize(size)}
                          >
                            {size}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-md">
                  <button
                    className="px-3 cursor-pointer py-1 bg-gray-300 hover:bg-gray-400 text-black font-semibold rounded-l-md"
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  >
                    -
                  </button>
                  <span className="px-4 bg-gray-100 py-1">{quantity}</span>
                  <button
                    className="px-3 cursor-pointer py-1 bg-gray-300 hover:bg-gray-400 text-black font-semibold rounded-r-md"
                    onClick={() => setQuantity((prev) => prev + 1)}
                  >
                    +
                  </button>
                </div>

                {productDetails?.stock > 0 ? (
                  <span className="text-green-600 font-semibold">
                    In Stock{" "}
                    <span className="text-gray-500 font-medium">
                      (Stock {productDetails?.stock})
                    </span>
                  </span>
                ) : (
                  <span className="text-red-600 font-semibold">
                    Out of Stock
                  </span>
                )}
              </div>

              <button
                className={`flex mt-6 items-center gap-2 px-5 py-[10px] bg-[#ff5722] hover:bg-[#e64a19] text-white font-medium rounded-lg transition ${productDetails?.stock === 0 ? "opacity-50 cursor-not-allowed" : "opacity-100 cursor-pointer"}`}
                onClick={() =>
                  addToCart(
                    {
                      ...productDetails,
                      quantity,
                      selectedOptions: {
                        color: isSelectedColor,
                        size: isSelectedSize,
                      },
                    },
                    user,
                    location,
                    deviceInfo,
                  )
                }
                disabled={isInCart || productDetails?.stock === 0}
              >
                <ShoppingCart size={18} />
                {productDetails?.stock > 0 ? "Add to Cart" : "Out of Stock"}
              </button>
            </div>
          </div>
        </div>
        {/* Right column */}
        <div></div>
      </div>
    </div>
  );
};

export default ProductDetails;
