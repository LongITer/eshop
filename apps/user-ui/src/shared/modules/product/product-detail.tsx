"use client";
import ImageMagnifier from "@/shared/components/image-magnifier";
import Ratings from "@/shared/ratings";
import { ChevronLeft, Heart } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

const ProductDetails = ({ productDetails }: { productDetails: any }) => {
  const mainImage = productDetails?.images?.[0]?.url || "/default-image.jpg";
  const [currentImage, setCurrentImage] = useState(
    productDetails?.images[0]?.url,
  );
  const [currentIndex, setCurrentIndex] = useState(0);

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
          <h1 className="text-xl mb-2 font-medium">{productDetails.title}</h1>
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
                fill="red"
                className="cursor-pointer"
                color="transparent"
              />
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
