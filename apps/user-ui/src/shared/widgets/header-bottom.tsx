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
        className={`w-[80%] relative m-auto flex items-center justify-between ${isSticky ? "pt-3" : "py-0"}`}
      >
        {/* All Dropdown */}
        <button type="button" aria-expanded={show} aria-controls="header-categories"
          className={`w-[260px] ${isSticky && "-mb-2"} cursor-pointer flex items-center justify-between px-5 h-[50px] bg-[#3489FF]`}
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
            id="header-categories" className={`absolute z-50 left-0 ${isSticky ? "top-[70px]" : "top-[50px]"} w-[260px] max-h-96 overflow-y-auto border bg-white shadow-lg`}
          >{categories.isLoading ? <p className="p-3">{t("Đang tải…")}</p> : categories.isError ? <button className="p-3" onClick={()=>categories.refetch()}>{t("Tải lại danh mục")}</button> : categories.data?.categories?.map((category:string)=><Link className="block p-3 hover:bg-blue-50" key={category} href={`/products?categories=${encodeURIComponent(category)}`} onClick={()=>setShow(false)}>{category}</Link>)}<Link href="/products" className="block p-3 text-blue-600" onClick={()=>setShow(false)}>{t("Xem tất cả sản phẩm")}</Link></div>
        )}

        {/* Navigation Links*/}
        <div className="flex items-center">
          {navItems.map((i: NavItemsTypes, index: number) => (
            <Link
              className="px-5 font-medium text-lg"
              href={i.href}
              key={index}
            >
              {t(i.title)}
            </Link>
          ))}
        </div>

        <div>
          {isSticky && (
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-5">
                <Link href={"/wishlist"} className="relative">
                  <HeartIcon />
                  <div className="w-6 h-6 border-2 border-white bg-red-500 rounded-full flex items-center justify-center absolute top-[-10px] right-[-10px]">
                    <span className="text-white font-medium text-sm">
                      {wishList?.length}
                    </span>
                  </div>
                </Link>
                <Link href={"/cart"} className="relative">
                  <ShoppingCart />
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
