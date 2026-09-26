"use client";

import useDeviceTracking from "@/hooks/useDeviceTracking";
import useLocationTracking from "@/hooks/useLocationTracking";
import useUser from "@/hooks/useUser";
import ProductCard from "@/shared/cards/product-card";
import ImageMagnifier from "@/shared/components/image-magnifier";
import Ratings from "@/shared/ratings";
import { useStore } from "@/store";
import axiosInstance from "@/utils/axioInstance";
import isProtected from "@/utils/protected";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Home,
  MapPin,
  MessageSquareText,
  Package,
  ShoppingCart,
  Store,
  WalletMinimal,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useCallback } from "react";

const ProductDetails = ({ productDetails }: { productDetails: any }) => {
  const [currentImage, setCurrentImage] = useState(
    productDetails?.images?.[0]?.url || "/default-image.jpg",
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  const { user, isLoading } = useUser();
  const location = useLocationTracking();
  const deviceInfo = useDeviceTracking();
  const router = useRouter();
  const [chatLoading, setChatLoading] = useState(false);

  const [isSelectedColor, setIsSelectedColor] = useState(
    productDetails?.color?.[0] || "",
  );

  const [isSelectedSize, setIsSelectedSize] = useState(
    productDetails?.size?.[0] || "",
  );

  const [quantity, setQuantity] = useState(1);

  const [priceRange, setPriceRange] = useState([
    0,
    2000,
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
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      setCurrentImage(productDetails?.images[newIndex]?.url);
    }
  };

  const nextImage = () => {
    if (currentIndex < productDetails?.images.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setCurrentImage(productDetails?.images[newIndex]?.url);
    }
  };

  const discountPercentage = Math.round(
    ((productDetails.regular_price - productDetails.sale_price) /
      productDetails.regular_price) *
      100,
  );

  const fetchFilteredProducts = useCallback(async () => {
    try {
      const query = new URLSearchParams();

      query.set("priceRange", priceRange.join(","));
      query.set("page", "1");
      query.set("limit", "10");

      // Filter by same category for better recommendations
      if (productDetails?.category) {
        query.set("categories", productDetails.category);
      }

      // Exclude current product
      if (productDetails?.id) {
        query.set("excludeId", productDetails.id);
      }

      const res = await axiosInstance.get(
        `/product/api/get-filtered-products?${query.toString()}`,
      );
      setRecommendedProducts(res.data.products);
    } catch (error) {
      console.error("Failed to fetch filtered products", error);
    }
  }, [priceRange, productDetails?.category, productDetails?.id]);

  useEffect(() => {
    fetchFilteredProducts();
  }, [fetchFilteredProducts]);

  const handleChat = async () => {
    if (chatLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setChatLoading(true);
    try {
      const res = await axiosInstance.post(
        "/chatting/api/create-user-conversationGroup",
        { sellerId: productDetails?.shop?.sellerId },
        isProtected,
      );
      router.push(`/inbox?conversationId=${res.data?.conversationId}`);
    } catch (error) {
      console.error("Failed to start chat", error);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="w-full bg-[#f5f5f5] min-h-screen">
      {/* Breadcrumb */}
      <div className="w-[90%] lg:w-[80%] mx-auto py-3">
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
            <Home size={14} />
            Home
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:text-blue-600 transition-colors">
            Products
          </Link>
          <span>/</span>
          <span className="text-gray-800 font-medium truncate max-w-[300px]">
            {productDetails?.title}
          </span>
        </nav>
      </div>

      {/* Main product section */}
      <div className="w-[90%] lg:w-[80%] mx-auto bg-white rounded-xl shadow-sm grid grid-cols-1 lg:grid-cols-[32%_40%_28%] overflow-hidden">
        {/* Left column - Image Gallery */}
        <div className="p-5">
          <div className="relative w-full">
            {/* Main image with zoom */}
            <div className="rounded-lg overflow-hidden border border-gray-100">
              <ImageMagnifier src={currentImage} alt={productDetails?.title} />
            </div>

            {/* Thumbnail images */}
            {productDetails?.images?.length > 1 && (
              <div className="relative flex items-center gap-2 mt-4">
                {productDetails?.images?.length > 4 && (
                  <button
                    className="absolute -left-1 bg-white rounded-full shadow-md z-10 p-1 hover:bg-gray-50 transition-colors disabled:opacity-30"
                    onClick={prevImage}
                    disabled={currentIndex === 0}
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}

                <div className="flex gap-2 overflow-x-auto mx-auto px-1 py-1 scrollbar-hide">
                  {productDetails?.images?.map((img: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentIndex(index);
                        setCurrentImage(img.url);
                      }}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 hover:opacity-100 ${
                        currentIndex === index
                          ? "border-orange-500 shadow-md opacity-100"
                          : "border-gray-200 opacity-70 hover:border-gray-300"
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={`${productDetails?.title} - ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (target.src !== window.location.origin + "/default-image.jpg") {
                            target.src = "/default-image.jpg";
                          }
                        }}
                      />
                    </button>
                  ))}
                </div>

                {productDetails?.images?.length > 4 && (
                  <button
                    className="absolute -right-1 bg-white rounded-full shadow-md z-10 p-1 hover:bg-gray-50 transition-colors disabled:opacity-30"
                    onClick={nextImage}
                    disabled={currentIndex === productDetails?.images?.length - 1}
                  >
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Middle column - product details */}
        <div className="p-5 lg:border-x border-gray-100">
          {/* Title */}
          <h1 className="text-2xl font-semibold text-gray-900 leading-tight">
            {productDetails.title}
          </h1>

          {/* Ratings and Reviews */}
          <div className="w-full flex items-center justify-between mt-3">
            <div className="flex items-center gap-2 text-yellow-500">
              <Ratings rating={productDetails?.rating} />
              <Link href={"#reviews"} className="text-sm text-blue-500 hover:underline">
                (0 review)
              </Link>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500">
                {productDetails.totalSales || 0} sold
              </span>
            </div>
            <button
              className="p-2 rounded-full hover:bg-red-50 transition-colors"
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
            >
              <Heart
                size={22}
                fill={isWishlisted ? "#ef4444" : "none"}
                className="transition-all duration-200"
                color={isWishlisted ? "#ef4444" : "#6b7280"}
              />
            </button>
          </div>

          <div className="py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">
              Brand:{" "}
              <Link
                href="#"
                className="text-blue-600 font-medium hover:underline"
              >
                {productDetails?.brand || "No brand"}
              </Link>
            </span>
          </div>

          {/* Price section */}
          <div className="mt-4 bg-orange-50 rounded-lg px-4 py-3">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-orange-600">
                ${productDetails?.sale_price}
              </span>
              <span className="text-lg text-gray-400 line-through">
                ${productDetails?.regular_price}
              </span>
              <span className="bg-orange-600 text-white text-xs font-bold px-2 py-1 rounded">
                -{discountPercentage}%
              </span>
            </div>
          </div>

          {/* Options */}
          <div className="mt-5 space-y-4">
            <div className="flex flex-col md:flex-row items-start gap-6">
              {/* Color options */}
              {productDetails?.colors?.length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-gray-700">Color:</span>
                  <div className="flex gap-2 mt-2">
                    {productDetails?.colors?.map(
                      (color: string, index: number) => (
                        <button
                          key={index}
                          className={`w-7 h-7 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
                            isSelectedColor === color
                              ? "border-gray-600 scale-110 shadow-lg ring-2 ring-offset-2 ring-gray-300"
                              : "border-gray-200"
                          }`}
                          onClick={() => setIsSelectedColor(color)}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Size options */}
              {productDetails?.sizes?.length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-gray-700">Size:</span>
                  <div className="flex gap-2 mt-2">
                    {productDetails?.sizes?.map(
                      (size: string, index: number) => (
                        <button
                          key={index}
                          className={`min-w-[40px] px-3 py-1.5 text-sm font-semibold rounded-lg border transition-all duration-200 ${
                            isSelectedSize === size
                              ? "bg-orange-500 text-white border-orange-500 shadow-md scale-105"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
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

          {/* Quantity & Stock */}
          <div className="mt-6">
            <span className="text-sm font-semibold text-gray-700 block mb-2">Quantity:</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold transition-colors cursor-pointer"
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                >
                  −
                </button>
                <span className="px-5 py-2 text-center font-medium min-w-[50px] bg-white">
                  {quantity}
                </span>
                <button
                  className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold transition-colors cursor-pointer"
                  onClick={() => setQuantity((prev) => prev + 1)}
                >
                  +
                </button>
              </div>

              {productDetails?.stock > 0 ? (
                <span className="text-sm">
                  <span className="text-green-600 font-semibold">In Stock</span>{" "}
                  <span className="text-gray-400">
                    ({productDetails?.stock} available)
                  </span>
                </span>
              ) : (
                <span className="text-red-500 font-semibold text-sm">
                  Out of Stock
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ${
                  productDetails?.stock === 0 || isInCart
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer active:scale-[0.98]"
                }`}
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
                {isInCart
                  ? "Already in Cart"
                  : productDetails?.stock > 0
                    ? "Add to Cart"
                    : "Out of Stock"}
              </button>
            </div>
          </div>
        </div>

        {/* Right column - Seller information */}
        <div className="bg-[#fafafa] p-4 space-y-0">
          {/* Delivery options */}
          <div className="pb-3 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Delivery options
            </span>
            <div className="flex items-center text-gray-700 gap-1.5 mt-1.5">
              <MapPin size={16} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm font-medium">
                {location?.city + ", " + location?.country}
              </span>
            </div>
          </div>

          {/* Return & Warranty */}
          <div className="py-3 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Return & Warranty
            </span>
            <div className="flex items-center text-gray-700 gap-1.5 mt-1.5">
              <Package size={16} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm">7 Days Returns</span>
            </div>
            <div className="flex items-center text-gray-700 gap-1.5 mt-1.5">
              <WalletMinimal size={16} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm">
                {productDetails?.warranty || "Warranty not available"}
              </span>
            </div>
          </div>

          {/* Sold by section */}
          <div className="pt-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs text-gray-500">Sold by</span>
                <Link
                  href={`/shop/${productDetails?.shop?.id}`}
                  className="block max-w-[150px] truncate font-semibold text-base text-blue-600 hover:underline mt-0.5"
                >
                  {productDetails?.shop?.name}
                </Link>
              </div>
              <button
                onClick={handleChat}
                disabled={chatLoading}
                className="flex items-center gap-1 text-blue-500 text-sm hover:text-blue-700 transition-colors mt-1 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              >
                <MessageSquareText size={16} />
                {chatLoading ? "Opening..." : "Chat"}
              </button>
            </div>

            {/* Seller performance stats */}
            <div className="grid grid-cols-3 gap-2 border-t border-gray-200 mt-3 pt-3">
              <div>
                <p className="text-[11px] text-gray-400 leading-tight">
                  Positive Seller Ratings
                </p>
                <p className="text-base font-bold text-gray-800 mt-0.5">80%</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 leading-tight">Ship on time</p>
                <p className="text-base font-bold text-gray-800 mt-0.5">100%</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 leading-tight">
                  Chat Response
                </p>
                <p className="text-base font-bold text-gray-800 mt-0.5">100%</p>
              </div>
            </div>

            {/* Go to Store */}
            <div className="text-center mt-4 border-t border-gray-200 pt-3">
              <Link
                href={`/shop/${productDetails?.shop.id}`}
                className="inline-flex items-center gap-1.5 text-blue-600 font-semibold text-sm hover:underline transition-colors"
              >
                <Store size={15} />
                GO TO STORE
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Product Description Section */}
      <div className="w-[90%] lg:w-[80%] mx-auto mt-5">
        <div className="bg-white rounded-xl shadow-sm p-6 overflow-hidden">
          <h3 className="text-lg font-bold text-gray-900 pb-3 border-b border-gray-100">
            Product Details
          </h3>
          <div
            className="prose prose-sm max-w-none mt-4 text-gray-700 leading-relaxed break-words overflow-hidden
              prose-headings:text-gray-900 prose-headings:font-semibold
              prose-p:text-gray-700 prose-p:leading-relaxed
              prose-strong:text-gray-800
              prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
              prose-li:text-gray-700
              prose-img:rounded-lg prose-img:shadow-sm"
            dangerouslySetInnerHTML={{
              __html: productDetails?.detailed_description,
            }}
          />

          {/* Short description fallback */}
          {!productDetails?.detailed_description && productDetails?.short_description && (
            <p className="mt-4 text-gray-600 leading-relaxed">
              {productDetails.short_description}
            </p>
          )}
        </div>
      </div>

      {/* Ratings & Reviews Section */}
      <div id="reviews" className="w-[90%] lg:w-[80%] mx-auto">
        <div className="bg-white rounded-xl shadow-sm mt-5 p-6">
          <h3 className="text-lg font-bold text-gray-900 pb-3 border-b border-gray-100">
            Ratings & Reviews
          </h3>
          <p className="text-center text-gray-400 py-12">
            No reviews available yet. Be the first to review this product!
          </p>
        </div>
      </div>

      {/* Recommended Products Section */}
      {recommendedProducts.length > 0 && (
        <div className="w-[90%] lg:w-[80%] mx-auto">
          <div className="w-full h-full my-5">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              You may also like
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {recommendedProducts.map((i: any) => (
                <ProductCard key={i.id} product={i} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  );
};

export default ProductDetails;
