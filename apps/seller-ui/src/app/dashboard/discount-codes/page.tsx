"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import axiosInstance from "apps/seller-ui/src/utils/axioInstance";
import { ChevronRight, Plus, Trash, X } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import Input from "packages/components/input";
import DeleteDiscountCodeModal from "apps/seller-ui/src/shared/components/modals/delete.discount-codes";

const Page = () => {
  const [showModel, setShowModel] = useState(false);
  const [showDeleteModel, setShowDeleteModel] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: discountCodes = [], isLoading } = useQuery({
    queryKey: ["shop-discounts"],
    queryFn: async () => {
      const res = await axiosInstance.get("/product/api/get-discount-code");
      return res?.data?.discount_codes || [];
    },
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      public_name: "",
      discountType: "percentage",
      discountValue: "",
      discountCode: "",
    },
  });

  const createDiscountCodeMutation = useMutation({
    mutationFn: async (data) => {
      await axiosInstance.post("/product/api/create-discount-code", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-discounts"] });
      reset();
      setShowModel(false);
      toast.success("Discount code created successfully!");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Failed to create discount code",
      );
    },
  });

  const deleteDiscountCodeMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosInstance.delete(`/product/api/delete-discount-code/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-discounts"] });
      setShowDeleteModel(false);
      toast.success("Discount code deleted successfully!");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Failed to delete discount code",
      );
    },
  });

  const handleDeleteClick = (discount: any) => {
    setSelectedDiscount(discount);
    setShowDeleteModel(true);
  };

  const onSubmit = async (data: any) => {
    if (discountCodes?.length >= 8) {
      toast.error("You can only create up to 8 discount codes.");
      return;
    }
    createDiscountCodeMutation.mutate(data);
  };

  return (
    <div className="w-full min-h-screen p-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-semibold text-white">Discount Codes</h2>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
          onClick={() => setShowModel(true)}
        >
          <Plus size={18} />
          Create Discount
        </button>
      </div>
      {/* BreadCrumbs */}
      <div className="flex items-center text-white">
        <Link className="text-[#80Deea] cursor-pointer" href="/dashboard">
          Dashboard
        </Link>
        <ChevronRight size={20} className="opacity-[.8]" />
        <span>Discount Codes</span>
      </div>

      <div className="mt-8 bg-gray-900 p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold text-white mb-4">
          Your Discount Codes
        </h3>

        {isLoading ? (
          // 1. Nếu đang loading thì chỉ hiện cái này
          <p className="text-gray-400 text-center">Loading discounts ...</p>
        ) : discountCodes && discountCodes.length > 0 ? (
          // 2. Nếu đã load xong và CÓ dữ liệu thì hiện bảng
          <table className="w-full text-white ">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Value</th>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-black">
              {discountCodes.map((discount: any) => (
                <tr
                  key={discount?.id}
                  className="border-b border-gray-700 hover:border-gray-600"
                >
                  <td className="p-3">{discount?.public_name}</td>
                  <td className="p-3 capitalize">
                    {discount?.discountType === "percentage"
                      ? "Percentage (%)"
                      : "Flat ($)"}
                  </td>
                  <td className="p-3">
                    {discount?.discountType === "percentage"
                      ? `${discount?.discountValue}%`
                      : `$${discount?.discountValue}`}
                  </td>
                  <td className="p-3">{discount?.discountCode}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDeleteClick(discount)}
                      className="text-red-500 hover:text-red-400 transition"
                    >
                      <Trash size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          // 3. Nếu đã load xong nhưng KHÔNG có dữ liệu thì hiện "No discount"
          <p className="text-gray-400 w-full pt-4 block text-center">
            No discount codes Available!
          </p>
        )}
      </div>

      {/* Create discount model */}
      {showModel && (
        <div className="fixed top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center">
          <div className="bg-black p-6 border border-gray-700 rounded-lg w-[450px] shadow-lg">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-gray-700 pb-3">
              <h3 className="text-xl text-white">Create Discount Code</h3>
              <button
                onClick={() => setShowModel(false)}
                className="text-gray-400 hover:text-white cursor-pointer "
              >
                <X size={22} />
              </button>
            </div>
            {/* Form Content */}
            <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
              {/* Title */}
              <Input
                label="Title (public name)"
                {...register("public_name", { required: "Title is required" })}
              />
              {errors.public_name && (
                <span className="text-red-500">
                  {errors.public_name.message}
                </span>
              )}

              {/* Discount Type  */}
              <div className="mt-4">
                <label className="block font-semibold text-gray-300 mb-1">
                  Discount Type
                </label>
                <Controller
                  control={control}
                  name="discountType"
                  render={({ field }) => (
                    <select
                      {...field}
                      className="w-full border outline-none border-gray-700 bg-transparent h-[40px] text-white"
                    >
                      <option
                        value="percentage"
                        className="bg-gray-800 text-white"
                      >
                        Percentage (%)
                      </option>
                      <option value="flat" className="bg-gray-800 text-white">
                        Flat Rate ($)
                      </option>
                    </select>
                  )}
                />
              </div>

              {/* Discount value */}
              <div className="mt-3">
                <Input
                  label="Discount value"
                  type="number"
                  min={1}
                  {...register("discountValue", {
                    required: "Discount value is required",
                  })}
                />
              </div>

              {/* Discount Code  */}
              <div className="mt-2">
                <Input
                  label="Discount Code"
                  {...register("discountCode", {
                    required: "Discount code is required",
                  })}
                />
              </div>

              <button
                type="submit"
                disabled={createDiscountCodeMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-semibold mt-5 w-full flex items-center justify-center gap-2"
              >
                {createDiscountCodeMutation.isPending ? (
                  "Creating..."
                ) : (
                  <>
                    <Plus size={20} /> Create
                  </>
                )}
              </button>

              {createDiscountCodeMutation.isError && (
                <span className="text-red-500">
                  {createDiscountCodeMutation.error?.message}
                </span>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Delete Model */}
      {showDeleteModel && selectedDiscount && (
        <DeleteDiscountCodeModal
          discount={selectedDiscount}
          onClose={() => setShowDeleteModel(false)}
          onConfirm={() =>
            deleteDiscountCodeMutation.mutate(selectedDiscount.id)
          }
        />
      )}
    </div>
  );
};

export default Page;
