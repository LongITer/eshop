"use client";
import axiosInstance from "@/utils/axioInstance";
import { countries } from "@/utils/countries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

import React, { useState } from "react";
import { useForm } from "react-hook-form";

const ShippingAddressSection = () => {
  const [showModel, setShowModel] = useState(false);
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

  const { mutate: addAddress } = useMutation({
    mutationFn: async (payload: any) => {
      const res = await axiosInstance.post("/api/add-address", payload);
      return res.data.address;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-addresses"] });
      toast.success("Address added successfully!");
      reset();
      setShowModel(false);
    },
  });

  // Get addresses
  const { data: addresses, isLoading } = useQuery({
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
      toast.success("Address deleted successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete address");
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-800">Saved Address</h2>
        <button
          onClick={() => setShowModel(true)}
          className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline"
        >
          <Plus className="w-4 h-4" />
          Add New Address
        </button>
      </div>

      {/* Address list */}
      <div>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading Addresses ...</p>
        ) : !addAddress || addAddress.length === 0 ? (
          <p className="text-sm text-gray-600">No saved addresses found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((address: any) => (
              <div
                key={address.id}
                className="border border-gray-200 rounded-md p-4 relative"
              >
                {address.isDefault && (
                  <span className="absolute top-2 right-2 bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                    Default
                  </span>
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
                  <button
                    className="flex items-center gap-1 !cursor-pointer text-xs text-red-500"
                    onClick={() => deleteAddress(address.id)}
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Model */}
      {showModel && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
          <div className="bg-white w-full max-w-md p-6 rounded-md shadow-md relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              onClick={() => setShowModel(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold mb-3 text-gray-800">
              Add New Address
            </h3>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <select
                {...register("label")}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              >
                <option value="Home">Home</option>
                <option value="Work">Work</option>
                <option value="Other">Other</option>
              </select>

              <input
                placeholder="Name"
                {...register("name", { required: "Name is required" })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              {errors.name && (
                <p className="text-red-500 text-xs">{errors.name.message}</p>
              )}

              <input
                placeholder="Street"
                {...register("street", { required: "Street is required" })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              {errors.street && (
                <p className="text-red-500 text-xs">{errors.street.message}</p>
              )}

              <input
                placeholder="City"
                {...register("city", { required: "City is required" })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              {errors.city && (
                <p className="text-red-500 text-xs">{errors.city.message}</p>
              )}

              <input
                placeholder="ZIP Code"
                {...register("zip", { required: "ZIP Code is required" })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
              {errors.zip && (
                <p className="text-red-500 text-xs">{errors.zip.message}</p>
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
                <option value="true">Set as Default</option>
                <option value="false">Not Default</option>
              </select>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white text-sm py-2 rounded-md hover:bg-blue-700 transition"
              >
                Save Address
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShippingAddressSection;
