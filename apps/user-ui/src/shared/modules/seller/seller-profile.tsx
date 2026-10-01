"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/utils/axioInstance";
import isProtected from "@/utils/protected";
import ProductCard from "@/shared/cards/product-card";
import {
  MapPin,
  Star,
  Clock,
  Heart,
  Users,
  Calendar,
  ExternalLink,
} from "lucide-react";

// Inline SVG social icons (lucide-react doesn't have brand icons)
const YoutubeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
  </svg>
);

const TwitterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.46 6c-.77.35-1.6.58-2.46.69a4.3 4.3 0 0 0 1.88-2.38 8.59 8.59 0 0 1-2.72 1.04 4.28 4.28 0 0 0-7.32 3.91A12.16 12.16 0 0 1 3 4.79a4.28 4.28 0 0 0 1.32 5.72 4.24 4.24 0 0 1-1.94-.54v.05a4.28 4.28 0 0 0 3.43 4.2 4.27 4.27 0 0 1-1.93.07 4.29 4.29 0 0 0 4 2.98A8.59 8.59 0 0 1 2 19.54a12.13 12.13 0 0 0 6.56 1.92c7.88 0 12.2-6.53 12.2-12.2 0-.19 0-.37-.01-.56A8.72 8.72 0 0 0 23 6.29a8.49 8.49 0 0 1-2.54.7z" />
  </svg>
);

const FacebookIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.8-4.69 4.54-4.69 1.31 0 2.68.23 2.68.23v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.27h3.33l-.53 3.49h-2.8v8.44C19.61 23.08 24 18.09 24 12.07z" />
  </svg>
);

const InstagramIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.97.24 2.44.41.61.24 1.05.52 1.51.98.46.46.74.9.98 1.51.17.47.36 1.27.41 2.44.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.24 1.97-.41 2.44-.24.61-.52 1.05-.98 1.51-.46.46-.9.74-1.51.98-.47.17-1.27.36-2.44.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.97-.24-2.44-.41a4.07 4.07 0 0 1-1.51-.98 4.07 4.07 0 0 1-.98-1.51c-.17-.47-.36-1.27-.41-2.44C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.24-1.97.41-2.44.24-.61.52-1.05.98-1.51a4.07 4.07 0 0 1 1.51-.98c.47-.17 1.27-.36 2.44-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.96 5.96 0 0 0-2.16 1.41A5.96 5.96 0 0 0 .57 4.2C.27 4.96.07 5.84.01 7.11.01 8.39 0 8.8 0 12.06s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91a5.96 5.96 0 0 0 1.41 2.16 5.96 5.96 0 0 0 2.16 1.41c.76.3 1.64.5 2.91.56C8.39 24 8.8 24 12.06 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.96 5.96 0 0 0 2.16-1.41 5.96 5.96 0 0 0 1.41-2.16c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.96 5.96 0 0 0-1.41-2.16A5.96 5.96 0 0 0 19.91.57C19.15.27 18.27.07 17 .01 15.72.01 15.31 0 12.05 0H12zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-11.05a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z" />
  </svg>
);

const TiktokIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.7a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.13z" />
  </svg>
);

const socialIcons: Record<string, { icon: React.FC; color: string; hoverColor: string }> = {
  youtube: { icon: YoutubeIcon, color: "bg-red-500", hoverColor: "hover:bg-red-600" },
  twitter: { icon: TwitterIcon, color: "bg-sky-400", hoverColor: "hover:bg-sky-500" },
  facebook: { icon: FacebookIcon, color: "bg-blue-600", hoverColor: "hover:bg-blue-700" },
  instagram: { icon: InstagramIcon, color: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400", hoverColor: "hover:opacity-90" },
  tiktok: { icon: TiktokIcon, color: "bg-black", hoverColor: "hover:bg-gray-800" },
};

const SellerProfile = ({ sellerData }: { sellerData: any }) => {
  const shop = sellerData?.shop;
  const [activeTab, setActiveTab] = useState<"products" | "offers" | "reviews">(
    "products",
  );
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(
    shop?.followers?.length ?? 0,
  );
  const [isLoading, setIsLoading] = useState(false);

  // Shop products are already included in the sellerData response
  const shopProducts = shop?.products ?? [];

  // Fetch shop events/offers
  const { data: shopOffers, isLoading: offersLoading } = useQuery({
    queryKey: ["shop-offers", shop?.id],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `/product/api/get-all-events?page=1&limit=20&shopId=${shop?.id}`,
      );
      return res.data.events;
    },
    enabled: !!shop?.id,
    staleTime: 1000 * 60 * 2,
  });

  const handleFollow = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (isFollowing) {
        await axiosInstance.post(
          `/seller/api/unfollow-shop`,
          { shopId: shop?.id },
          isProtected,
        );
        setIsFollowing(false);
        setFollowerCount((prev: number) => Math.max(0, prev - 1));
      } else {
        await axiosInstance.post(
          `/seller/api/follow-shop`,
          { shopId: shop?.id },
          isProtected,
        );
        setIsFollowing(true);
        setFollowerCount((prev: number) => prev + 1);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const joinedDate = shop?.createdAt
    ? new Date(shop.createdAt).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "N/A";

  const tags = shop?.category
    ? shop.category.split(",").map((t: string) => t.trim())
    : [];

  // Parse social links from shop data (stored as Json in DB)
  const parsedSocialLinks: Record<string, string> =
    typeof shop?.socialLinks === "string"
      ? (() => { try { return JSON.parse(shop.socialLinks); } catch { return {}; } })()
      : shop?.socialLinks ?? {};

  const socialLinksToDisplay =
    Object.keys(parsedSocialLinks).length > 0
      ? parsedSocialLinks
      : {
          facebook: "https://facebook.com",
          instagram: "https://instagram.com",
          youtube: "https://youtube.com",
          twitter: "https://x.com",
          tiktok: "https://tiktok.com",
        };

  const tabs = [
    { key: "products" as const, label: "Products" },
    { key: "offers" as const, label: "Offers" },
    { key: "reviews" as const, label: "Reviews" },
  ];

  return (
    <div className="w-full bg-[#f3f4f6] min-h-screen text-slate-800">
      <div className="w-[94%] lg:w-[80%] mx-auto pt-5 md:pt-8">
        <div className="relative h-[220px] overflow-hidden border border-white/30 border-b-0 shadow-[0_18px_40px_rgba(79,70,229,0.12)] bg-[linear-gradient(90deg,_#7c3aed_0%,_#8b5cf6_25%,_#d946ef_52%,_#4f46e5_100%)] md:h-[300px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08),_transparent_45%),linear-gradient(90deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0)_42%,_rgba(15,23,42,0.08)_100%)]" />
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:16px_16px]" />

          <div className="relative flex items-center justify-between px-4 md:px-6 py-4 md:py-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur-sm">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/90 text-[10px] text-white">✓</span>
              Verified Premier Partner
            </div>

            <button className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-[#1f2937]/30 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-[#1f2937]/40">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"/>
                <path d="M8 9h8M8 13h5"/>
              </svg>
              Store Cover
            </button>
          </div>

          <div className="relative px-4 pb-4 md:px-6 md:pb-5" />
        </div>

        <div className="relative z-10 -mt-6 w-full border border-slate-200 border-t-0 bg-white/95 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm md:p-5">
          <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="relative shrink-0">
                <div className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-[24px] border-[4px] border-white bg-gradient-to-br from-violet-500 to-pink-500 shadow-[0_8px_18px_rgba(168,85,247,0.35)] md:h-[98px] md:w-[98px]">
                  {shop?.avatar ? (
                    <img
                      src={shop.avatar}
                      alt={shop.name || "Shop"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[2rem] font-bold text-white">
                      {shop?.name?.[0]?.toUpperCase() || "S"}
                    </span>
                  )}
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-[10px] text-white shadow-sm">
                  ✓
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <h1 className="text-2xl font-semibold tracking-[-0.05em] text-slate-900 md:text-[2.1rem]">
                    {shop?.name || "Shop Name"}
                  </h1>
                  {tags.slice(0, 1).map((tag: string, idx: number) => (
                    <span
                      key={idx}
                      className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 ring-1 ring-violet-100"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <p className="mt-2 max-w-[620px] text-sm leading-6 text-slate-600 md:text-[15px]">
                  {shop?.bio || "Welcome to our shop! Browse our amazing collection of products."}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-slate-800">{shop?.ratings?.toFixed(1) || "0.0"}</span>
                    <span className="text-slate-500">({shop?.reviews?.length ?? 0} reviews)</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <Users size={14} className="text-blue-500" />
                    <span className="font-semibold text-slate-800">{followerCount}</span>
                    <span>Followers</span>
                  </span>

                  {shop?.opening_hours && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={14} className="text-slate-500" />
                      <span>{shop.opening_hours}</span>
                    </span>
                  )}
                </div>

                {shop?.address && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin size={14} className="text-slate-400" />
                    {shop.address}
                  </p>
                )}

                <div className="mt-2 flex w-full items-center gap-1.5 text-sm text-slate-500">
                  <Calendar size={14} className="text-slate-400" />
                  <span>Joined at {joinedDate}</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFollow}
                  disabled={isLoading}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm transition ${
                    isFollowing
                      ? "bg-red-50 text-red-500 ring-1 ring-red-200 hover:bg-red-100"
                      : "bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600"
                  }`}
                >
                  <Heart size={16} fill={isFollowing ? "currentColor" : "none"} />
                  {isFollowing ? "Unfollow" : "Follow Store"}
                </button>

                <button className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                  Message
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="mr-1 text-xs font-medium text-slate-500">Follow us</span>
                {Object.entries(socialLinksToDisplay).slice(0, 4).map(([platform, url]) => {
                  if (!url) return null;
                  const config = socialIcons[platform.toLowerCase()];
                  const IconComponent = config?.icon ?? ExternalLink;
                  return (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
                      title={platform}
                    >
                      <IconComponent />
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 w-[94%] lg:w-[80%] mx-auto">
        <div className="bg-white shadow-sm border border-gray-100">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3.5 text-sm font-semibold transition-all cursor-pointer border-b-2 ${
                  activeTab === tab.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5 md:p-6">
            {activeTab === "products" && (
              <div>
                {shopProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-5">
                    {shopProducts.map((product: any) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-12">
                    No products available yet.
                  </p>
                )}
              </div>
            )}

            {activeTab === "offers" && (
              <div>
                {offersLoading && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-5">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-[280px] bg-gray-200 animate-pulse rounded-lg"
                      />
                    ))}
                  </div>
                )}

                {!offersLoading && shopOffers?.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-5">
                    {shopOffers.map((product: any) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        isEvent={true}
                      />
                    ))}
                  </div>
                )}

                {!offersLoading && (!shopOffers || shopOffers?.length === 0) && (
                  <p className="text-center text-gray-500 py-12">
                    No offers available yet.
                  </p>
                )}
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="text-center py-12">
                <p className="text-gray-500">No reviews available yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="h-10" />
    </div>
  );
};

export default SellerProfile;
