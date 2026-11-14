"use client";
import { useStorefrontText } from '@packages/components/storefront-language';

import {
  AlignLeft,
  ChevronDown,
  HeartIcon,
  ShoppingCart,
  User,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { navItems } from "../../config/constants";
import useUser from "../../hooks/useUser";
import { useStore } from "../../store";
import { useQuery } from '@tanstack/react-query';
import axios from '@/utils/axioInstance';
import { NotificationBadge } from '../components/account-tools';

const HeaderBottom = () => {
  const { t } = useStorefrontText();
  const [show, setShow] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await axios.get('/product/api/get-categories')).data });
  const { user, isLoading } = useUser();
  const wishList = useStore((state: any) => state.wishlist);
  const cart = useStore((state: any) => state.cart);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return (
    <div
      className={`w-full transition-all duration-300 ${isSticky ? "fixed top-0 left-0 z-[100] bg-white shadow-lg" : ""}`}
    >
      <div
        className={`relative m-auto flex items-center justify-between gap-4 ${isSticky ? "w-[94%] max-w-[1440px] py-2" : "w-[94%] xl:w-[80%] py-0"}`}
      >
        {/* All Dropdown */}
        <button type="button" aria-expanded={show} aria-controls="header-categories"
          className={`${isSticky ? "w-[220px]" : "w-[220px] xl:w-[260px]"} hidden shrink-0 cursor-pointer items-center justify-between px-5 h-[50px] bg-[#3489FF] lg:flex`}
          onClick={() => setShow(!show)}
        >
          <div className="flex items-center gap-2">
            <AlignLeft color="white" />
            <span className="text-white font-medium">{t("Tất cả danh mục")}</span>
          </div>
          <ChevronDown color="white" />
        </button>

        {/* Dropdown menu */}
        {show && (
          <div
            id="header-categories" className={`absolute z-50 left-0 hidden lg:block ${isSticky ? "top-[66px]" : "top-[50px]"} w-[260px] max-h-96 overflow-y-auto border border-slate-200 bg-white shadow-lg`}
          >{categories.isLoading ? <p className="p-3">{t("Đang tải…")}</p> : categories.isError ? <button className="p-3" onClick={()=>categories.refetch()}>{t("Tải lại danh mục")}</button> : categories.data?.categories?.map((category:string)=><Link className="block p-3 hover:bg-blue-50" key={category} href={`/products?categories=${encodeURIComponent(category)}`} onClick={()=>setShow(false)}>{category}</Link>)}<Link href="/products" className="block p-3 text-blue-600" onClick={()=>setShow(false)}>{t("Xem tất cả sản phẩm")}</Link></div>
        )}

        {/* Navigation Links*/}
        <div className="flex min-w-0 flex-1 items-center justify-center">
          {navItems.map((i: NavItemsTypes, index: number) => (
            <Link
              className={`shrink-0 whitespace-nowrap font-medium ${isSticky ? 'px-2 lg:px-3 text-sm' : 'px-2 lg:px-3 xl:px-5 text-sm xl:text-lg'}`}
              href={i.href}
              key={index}
            >
              {t(i.title)}
            </Link>
          ))}
        </div>

        <div className="shrink-0">
          {isSticky && (
            <div className="flex shrink-0 items-center gap-4">
              <div className="hidden items-center gap-2 xl:flex">
                {!isLoading && user ? (
                  <>
                    <Link
                      href={"/profile"}
                      className="border-2 w-[50px] h-[50px] flex items-center justify-center rounded-full border-[#010f1c1a]"
                    >
                      <User />
                    </Link>
                    <Link href={"/profile"}>
                      <span className="block font-medium">{t("Xin chào")}</span>
                      <span className="block font-medium">
                        {user?.name?.split(" ")[0]}
                      </span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href={"/login"}
                      className="border-2 w-[50px] h-[50px] flex items-center justify-center rounded-full border-[#010f1c1a]"
                    >
                      <User />
                    </Link>
                    <Link href={"/login"}>
                      <span className="block font-medium">{t("Xin chào")}</span>
                      <span className="block font-medium">
                        {isLoading ? "..." : t("Đăng nhập")}
                      </span>
                    </Link>
                  </>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-5 py-1">
                <NotificationBadge />
                <Link href={"/wishlist"} aria-label={`${t("Yêu thích")}: ${wishList?.length ?? 0}`} className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
                  <HeartIcon size={24} aria-hidden="true" />
                  <div className="w-6 h-6 border-2 border-white bg-red-500 rounded-full flex items-center justify-center absolute top-[-10px] right-[-10px]">
                    <span className="text-white font-medium text-sm">
                      {wishList?.length}
                    </span>
                  </div>
                </Link>
                <Link href={"/cart"} aria-label={`${t("Giỏ hàng")}: ${cart?.length ?? 0}`} className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
                  <ShoppingCart size={24} aria-hidden="true" />
                  <div className="w-6 h-6 border-2 border-white bg-red-500 rounded-full flex items-center justify-center absolute top-[-10px] right-[-10px]">
                    <span className="text-white font-medium text-sm">
                      {cart?.length}
                    </span>
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HeaderBottom;
