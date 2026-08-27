"use client";
import ProductCard from "@/shared/cards/product-card";
import axiosInstance from "@/utils/axioInstance";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const ProductListingPage = () => {
  const router = useRouter();
  const [isShopLoading, setIsShopLoading] = useState(false);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [shops, setShops] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [tempPriceRange, setTempPriceRange] = useState([0, 1199]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const colors = [
    { name: "Black", code: "#000" },
    { name: "Red", code: "#ff0000" },
    { name: "Green", code: "#00ff00" },
    { name: "Blue", code: "#0000ff" },
    { name: "Yellow", code: "#ffff00" },
    { name: "Magenta", code: "#ff00ff" },
    { name: "Cyan", code: "#00ffff" },
  ];

  const toggleCategory = (label: string) => {
    setSelectedCategories((prev) =>
      prev.includes(label)
        ? prev.filter((cat) => cat !== label)
        : [...prev, label],
    );
  };

  const toggleCountry = (label: string) => {
    setSelectedCountries((prev) =>
      prev.includes(label)
        ? prev.filter((country) => country !== label)
        : [...prev, label],
    );
  };

  const updateURL = () => {
    const params = new URLSearchParams();
    if (selectedCategories.length > 0)
      selectedCategories.forEach((cat) => params.append("categories", cat));

    params.set("page", page.toString());

    router.replace(`/shop?${decodeURIComponent(params.toString())}`);
  };

  const fetchFilteredShops = async () => {
    setIsShopLoading(true);
    try {
      const query = new URLSearchParams();

      if (selectedCategories.length > 0)
        query.set("categories", selectedCategories.join(","));
      query.set("page", page.toString());
      query.set("limit", "12");

      const res = await axiosInstance.get(
        `/product/api/get-filtered-shops?${query.toString()}`,
      );
      setShops(res.data.shops);
      setTotalPages(res.data.pagination.totalPages);
    } catch (error) {
      console.error("Failed to fetch filtered shops: ", error);
    } finally {
      setIsShopLoading(false);
    }
  };

  useEffect(() => {
    updateURL();
    fetchFilteredShops();
  }, [selectedCategories, page]);

  return (
    <div className="w-full bg-[#f5f5f5] pb-10">
      <div className="w-[90%] lg:w-[80%] m-auto">
        <div className="pb-[50px]">
          <h1 className="md:pt-[40px] font-medium text-[44px] leading-1 mb-[14px] font-jost">
            All Shops
          </h1>
          <Link href={"/"} className="text-[#55585b] hover:underline">
            Home
          </Link>
          <span className="inline-block p-[1.5px] mx-1 bg-[#a8acb0] rounded-full"></span>
          <span className="text-[#55585b]">All Products</span>
        </div>

        <div className="w-full flex flex-cols lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full lg:w-[270px] !rounded bg-white p-4 space-y-6 shadow-md">
            <h3 className="text-xl font-Poppins font-medium">Price Filter</h3>
            <div className="ml-2">
              <Range
                step={100}
                min={MIN}
                max={MAX}
                values={tempPriceRange}
                onChange={(e) => setTempPriceRange(e)}
                renderTrack={({ props, children }) => {
                  const [min, max] = tempPriceRange;
                  const percentageLeft = ((min - MIN) / (MAX - MIN)) * 100;
                  const percentageRight = ((max - MIN) / (MAX - MIN)) * 100;
                  return (
                    <div
                      {...props}
                      className="h-[6px] bg-blue-200 rounded relative"
                      style={{ ...props.style }}
                    >
                      <div
                        className="absolute h-full bg-blue-600 rounded"
                        style={{
                          left: `${percentageLeft}%`,
                          width: `${percentageRight - percentageLeft}%`,
                        }}
                      />
                      {children}
                    </div>
                  );
                }}
                renderThumb={({ props }) => {
                  const { key, ...rest } = props;
                  return (
                    <div
                      key={key}
                      {...rest}
                      className="w-[16px] h-[16px] bg-blue-600 rounded-full shadow"
                    ></div>
                  );
                }}
              />
              <div className="flex justify-between items-center mt-5">
                <div className="text-sm text-gray-600">
                  ${tempPriceRange[0]} - ${tempPriceRange[1]}
                </div>
                <button
                  onClick={() => {
                    setPriceRange(tempPriceRange);
                    setPage(1);
                  }}
                  className="text-sm px-4 py-1 bg-gray-200 hover:bg-blue-600 hover:text-white transition !rounded"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Categories */}
            <h3 className="text-xl font-Poppins font-medium border-b border-b-slate-300 pb-1">
              Categories
            </h3>
            <ul className="space-y-2 !mt-3">
              {isLoading ? (
                <p>Loading ...</p>
              ) : (
                data?.categories?.map((category: any) => (
                  <li
                    key={category}
                    className="flex items-center justify-between"
                  >
                    <label className="flex items-center gap-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category)}
                        onChange={() => toggleCategory(category)}
                        className="accent-blue-600"
                      />
                      {category}
                    </label>
                  </li>
                ))
              )}
            </ul>

            {/* Colors */}
            <h3 className="text-xl font-Poppins font-medium border-b border-b-slate-300 pb-1">
              Colors
            </h3>
            <ul className="space-y-2 !mt-3">
              {isLoading ? (
                <p>Loading ...</p>
              ) : (
                colors?.map((color: any) => (
                  <li key={color} className="flex items-center justify-between">
                    <label className="flex items-center gap-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedColors.includes(color.name)}
                        onChange={() => toggleColor(color.name)}
                        className="accent-blue-600"
                      />
                      <span
                        className="w-[16px] h-[16px] rounded-full border border-gray-200"
                        style={{ backgroundColor: color.code }}
                      ></span>
                      {color.name}
                    </label>
                  </li>
                ))
              )}
            </ul>

            {/* Sizes */}
            <h3 className="text-xl font-Poppins font-medium border-b border-b-slate-300 pb-1">
              Sizes
            </h3>
            <ul className="space-y-2 !mt-3">
              {isLoading ? (
                <p>Loading ...</p>
              ) : (
                sizes?.map((size: any) => (
                  <li key={size} className="flex items-center justify-between">
                    <label className="flex items-center gap-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedSizes.includes(size)}
                        onChange={() => toggleSize(size)}
                        className="accent-blue-600"
                      />
                      {size}
                    </label>
                  </li>
                ))
              )}
            </ul>
          </aside>

          {/* Product grid */}
          <div className="flex-1 px-2 lg:px-3">
            {isProductLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[250px] bg-gray-300 animate-pulse rounded-xl"
                  ></div>
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <p>No Offers found!</p>
            )}

            {totalPages > 1 && (
              <div className="flex justify-center mt-8 gap-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={`px-3 py-1 !rounded border border-gray-200 text-sm ${page === i + 1 ? "bg-blue-600 text-white" : "bg-white text-black"}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductListingPage;
