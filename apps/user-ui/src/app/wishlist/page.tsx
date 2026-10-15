"use client";
import { useStorefrontText } from '@packages/components/storefront-language';

import React from "react";
import useUser from "../../hooks/useUser";
import useLocationTracking from "../../hooks/useLocationTracking";
import useDeviceTracking from "../../hooks/useDeviceTracking";
import { useStore } from "../../store";
import Link from "next/link";
import Image from "next/image";

const Wishlist = () => {
  const { t } = useStorefrontText();
  const { user } = useUser();
  const location = useLocationTracking();
  const deviceInfo = useDeviceTracking();
  const removeFromWishlist = useStore((state: any) => state.removeFromWishlist);
  const wishlist = useStore((state: any) => state.wishlist);

  const removeItem = (id: string) => {
    removeFromWishlist(id, user, location, deviceInfo);
  };

  return (
    <div className="w-full bg-white">
      <div className="md:w-[80%] w-[95%] mx-auto min-h-screen">
        {/* Breadcrumb */}
        <div className="pb-[50px]">
          <h1 className="md:pt-[50px] font-medium text-[40px] leading-[1] mb-[16px] font-jost">
            {t("Sản phẩm yêu thích")}</h1>
          <Link href={"/"} className="text-[#55585b] hover:underline">
            {t("Trang chủ")}</Link>
          <span className="inline-block p-[1.5px] mx-1 bg-[#a8acbo] rounded-full"></span>
          <span className="text-[#55585b]">{t("Yêu thích")}</span>
        </div>
        <p className="mb-5 text-sm text-gray-500">{t("Giá lưu tham khảo. Mở sản phẩm để xem giá, tồn kho và lựa chọn hiện tại.")}</p>
        {/* If wishlist is empty */}
        {wishlist.length === 0 ? (
          <div className="text-center text-gray-600 text-lg">
            {t("Chưa có sản phẩm yêu thích. Hãy khám phá và lưu sản phẩm bạn quan tâm.")}</div>
        ) : (
          <div className="flex flex-col gap-10 overflow-x-auto">
            {/* Wishlist items table */}
            <table className="w-full min-w-[550px] border-collapse">
              <thead className="bg-[#f1f3f4]">
                <tr>
                  <th className="py-3 text-left pl-4">{t("Sản phẩm")}</th>
                  <th className="py-3 text-left">{t("Giá")}</th>
                  <th className="py-3 text-left">{t("Thao tác")}</th>
                  <th className="py-3 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {wishlist.map((item: any) => (
                  <tr key={item.id} className="border-b border-b-[#0000000e]">
                    <td className="flex items-center gap-3 p-4">
                      <Image
                        src={(typeof item.images?.[0]==='string'?item.images[0]:item.images?.[0]?.url)||item.image||'/product-placeholder.svg'} onError={e=>{e.currentTarget.srcset='';e.currentTarget.src='/product-placeholder.svg';}}
                        alt={item.title}
                        width={80}
                        height={80}
                        className="rounded"
                      />
                      <span>{item.title}</span>
                    </td>
                    <td className="px-6 text-lg">
                      ${Number(item.sale_price??item.price??0).toFixed(2)} USD
                    </td>
                    <td>
                      <Link
                        className="bg-[#2295FF] cursor-pointer text-white px-5 py-2 rounded-md hover:bg-[#007bff] transition-all duration-200"
                        href={`/product/${item.slug}`}
                      >
                        {t("Xem và chọn")}</Link>
                    </td>
                    <td>
                      <button
                        className="bg-[#dc3545] cursor-pointer text-white px-5 py-2 rounded-md hover:bg-[#c82333] transition-all duration-200"
                        onClick={() => removeItem(item.id)}
                      >
                        {t("Bỏ yêu thích")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;
