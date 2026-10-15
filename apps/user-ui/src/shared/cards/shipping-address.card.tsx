"use client";
import { useStorefrontText } from '@packages/components/storefront-language';

import axiosInstance from "@/utils/axioInstance";
import { countries } from "@/utils/countries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

import React, { useState } from "react";
import { useForm } from "react-hook-form";

const ShippingAddressSection = () => {
  const { t } = useStorefrontText();
  const [showModel, setShowModel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      label: "Home",
      name: "",
      street: "",
      city: "",
      zip: "",
      country: "Vietnam",
      isDefault: "false",
    },
  });

  const { mutate: addAddress, isPending: saving } = useMutation({
    mutationFn: async (payload: any) => {
      const res = editingId ? await axiosInstance.put(`/api/update-address/${editingId}`, payload) : await axiosInstance.post("/api/add-address", payload);
      return res.data.address;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-addresses"] });
      toast.success(t("Đã lưu địa chỉ."));
      setEditingId(null);
      reset();
      setShowModel(false);
    },
    onError: () => toast.error(t('Không lưu được địa chỉ.')),
  });

  // Get addresses
  const { data: addresses, isLoading, isError, refetch } = useQuery({
    queryKey: ["shipping-addresses"],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/shipping-addresses");
      return res.data.addresses;
    },
  });

  const onSubmit = (data: any) => {
    addAddress({
      ...data,
      isDefault: data.isDefault === "true",
    });
  };

  const { mutate: deleteAddress } = useMutation({
    mutationFn: async (id: string) => {
      await axiosInstance.delete(`/api/delete-address/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-addresses"] });
      toast.success(t("Đã xóa địa chỉ."));
    },
    onError: (error) => {
      toast.error(t(error.message || "Không xóa được địa chỉ."));
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">{t("Địa chỉ đã lưu")}</h2>
        <button
          onClick={() => { setEditingId(null); reset(); setShowModel(true); }}
          className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline"
        >
          <Plus className="w-4 h-4" />
          {t("Thêm địa chỉ")}</button>
      </div>

      {/* Address list */}
      <div>
        {isLoading ? (
          <p className="text-sm text-gray-500">{t("Đang tải địa chỉ…")}</p>
        ) : isError ? (
          <p role="alert" className="text-sm text-red-600">{t("Không tải được địa chỉ. ")}<button onClick={() => refetch()} className="underline">{t("Thử lại")}</button></p>
        ) : !addresses || addresses.length === 0 ? (
          <p className="text-sm text-gray-600">{t("Chưa có địa chỉ.")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((address: any) => (
              <div
                key={address.id}
                className="border border-gray-200 rounded-md p-4 relative"
              >
                {address.isDefault && (
                  <span className="absolute top-2 right-2 bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                    {t("Mặc định")}</span>
                )}
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <MapPin className="w-5 h-5 mt-0.5 text-gray-500" />
                  <div>
                    <p className="font-medium">
                      {address.label} - {address.name}
                    </p>
                    <p>
                      {address.street}, {address.city}, {address.zip},{" "}
                      {address.country}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button className="min-h-11 text-blue-600" onClick={() => { setEditingId(address.id); reset({ ...address, isDefault: String(address.isDefault) }); setShowModel(true); }}>{t("Sửa")}</button>
                  <button
                    className="flex items-center gap-1 !cursor-pointer text-xs text-red-500"
                    onClick={() => deleteAddress(address.id)}
                  >
                    <Trash2 className="w-4 h-4" /> {t(" Xóa")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Model */}
      {showModel && (
        <div role="dialog" aria-modal="true" aria-label={editingId?t('Sửa địa chỉ'):t('Thêm địa chỉ')} className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-[200]">
          <div className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto p-6 rounded-md shadow-md relative">
            <button
              aria-label={t("Đóng biểu mẫu địa chỉ")} className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              onClick={() => setShowModel(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              {editingId ? t('Sửa địa chỉ') : t('Thêm địa chỉ')}
            </h3>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <select
                {...register("label")}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              >
                <option value="Home">{t("Nhà riêng")}</option>
                <option value="Work">{t("Cơ quan")}</option>
                <option value="Other">{t("Khác")}</option>
              </select>

              <input
                placeholder={t("Tên người nhận")}
                {...register("name", { required: t("Nhập tên người nhận") })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              {errors.name && (
                <p className="text-red-500 text-xs">{t(String(errors.name.message || ""))}</p>
              )}

              <input
                placeholder={t("Số nhà, đường")}
                {...register("street", { required: t("Nhập địa chỉ") })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              {errors.street && (
                <p className="text-red-500 text-xs">{t(String(errors.street.message || ""))}</p>
              )}

              <input
                placeholder={t("Tỉnh/thành phố")}
                {...register("city", { required: t("Nhập tỉnh/thành phố") })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              {errors.city && (
                <p className="text-red-500 text-xs">{t(String(errors.city.message || ""))}</p>
              )}

              <input
                placeholder={t("Mã bưu chính")}
                {...register("zip", { required: t("Nhập mã bưu chính") })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              {errors.zip && (
                <p className="text-red-500 text-xs">{t(String(errors.zip.message || ""))}</p>
              )}

              <select
                {...register("country")}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              >
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>

              <select
                {...register("isDefault")}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              >
                <option value="true">{t("Đặt làm mặc định")}</option>
                <option value="false">{t("Không mặc định")}</option>
              </select>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white text-sm py-2 rounded-md hover:bg-blue-700 transition"
              >
                {t("Lưu địa chỉ")}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShippingAddressSection;
