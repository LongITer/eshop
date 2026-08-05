"use client";
import Link from "next/link";
import React from "react";
import { HeartIcon, Search, ShoppingCart, User } from "lucide-react";
import HeaderBottom from "./header-bottom";
import useUser from "../../hooks/useUser";
import { useStore } from "../../store";

const Header = () => {
  const { user, isLoading } = useUser();
  const wishList = useStore((state: any) => state.wishlist);
  const cart = useStore((state: any) => state.cart);

  return (
    <div className="w-full bg-white">
      <div className="w-[80%] py-5 m-auto flex items-center justify-between">
        <div>
          <Link href={"/"}>
            <span className="text-3xl font-[500]">Eshop</span>
          </Link>
        </div>
        <div className="w-[50%] relative">
          <input
            type="text"
            placeholder="Search for products ..."
            className="w-full px-4 font-Poppins font-medium border-[2.5px] border-[#3489FF]
                    outline-none h-[55px]
                    "
          />
          <div className="w-[60px] cursor-pointer flex items-center justify-center h-[55px] bg-[#3489FF] absolute top-0 right-0">
            <Search color="#fff" />
          </div>
        </div>
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
                  <span className="block font-medium">Hello</span>
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
                  <span className="block font-medium">Hello</span>
                  <span className="block font-medium">
                    {isLoading ? "..." : "Sign in"}
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
      </div>
      <div className="border-b border-b-slate-200" />
      <HeaderBottom />
    </div>
  );
};

export default Header;
