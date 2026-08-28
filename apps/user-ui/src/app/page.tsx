"use client";
import React from "react";
import Hero from "../shared/modules/hero";
import SectionTitle from "../shared/section/section-title";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../utils/axioInstance";
import ProductCard from "../shared/cards/product-card";
import ShopCard from "@/shared/cards/shop.cart";

const Page = () => {
  const {
    data: products,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await axiosInstance.get(
        "/product/api/get-all-products?page=1&limit=10",
      );
      return res.data.products;
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: latestProducts, isLoading: latestProductLoading } = useQuery({
    queryKey: ["latest-products"],
    queryFn: async () => {
      const res = await axiosInstance.get(
        "/product/api/get-all-products?page=1&limit=1&type=latest",
      );
      return res.data.products;
    },
  });

  const { data: shops, isLoading: shopLoading } = useQuery({
    queryKey: ["shops"],
    queryFn: async () => {
      const res = await axiosInstance.get("/product/api/top-shops");
      return res.data.shops;
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: offers, isLoading: offersLoading } = useQuery({
    queryKey: ["offers"],
    queryFn: async () => {
      const res = await axiosInstance.get(
        "/product/api/get-all-events?page=1&limit=10",
      );
      return res.data.events;
    },
    staleTime: 1000 * 60 * 2,
  });

  return (
    <div className="bg-white">
      <Hero />
      <div className="md:w-[80%] w-[90%] my-10 m-auto">
        <div className="mb-8">
          <SectionTitle title="Suggested Products" />
        </div>
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="h-[250px] bg-gray-300 animate-pulse rounded-xl"
              ></div>
            ))}
          </div>
        )}

        {!isLoading && !isError && (
          <div className="m-auto grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5 ">
            {products?.map((product: any) => (
              <div key={product.id}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}

        {products?.length === 0 && (
          <p className="text-center text-lg text-slate-500">
            No Products available.
          </p>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="h-[250px] bg-gray-300 animate-pulse rounded-xl"
              ></div>
            ))}
          </div>
        )}
        <div className="my-8 block">
          <SectionTitle title="Latest Products" />
        </div>

        {!latestProductLoading && !isError && (
          <div className="m-auto grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5 ">
            {latestProducts?.map((product: any) => (
              <div key={product.id}>
                <ProductCard product={product} />
              </div>
            ))}

            {latestProducts?.length === 0 && (
              <p className="text-center text-lg text-slate-500">
                No Products available.
              </p>
            )}
          </div>
        )}

        {latestProducts?.length === 0 && (
          <p className="text-center text-lg text-slate-500">
            No Products available yet!.
          </p>
        )}

        <div className="my-8 block">
          <SectionTitle title="Top Shops" />
        </div>

        {!shopLoading && (
          <div className="m-auto grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5">
            {shops?.map((shop: any) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        )}

        {shops?.length === 0 && (
          <p className="text-center text-lg text-slate-500">
            No Shops available yet!.
          </p>
        )}

        <div className="my-8 block">
          <SectionTitle title="Top Offers" />
        </div>

        {!offersLoading && !isError && (
          <div className="m-auto grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5">
            {offers?.map((product: any) => (
              <ProductCard key={product.id} product={product} isEvent={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Page;
