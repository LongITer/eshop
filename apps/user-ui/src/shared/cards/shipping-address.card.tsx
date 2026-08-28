"use client";
import { countries } from "@/utils/countries";
import { Plus, X } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";

const ShippingAddressSection = () => {
  const [showModel, setShowModel] = useState(false);

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

  const onSubmit = (data: any) => {
    console.log(data);
    reset();
    setShowModel(false);
  };

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
      <div></div>

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
              <select {...register("label")} className="input w-full">
                <option value="Home">Home</option>
                <option value="Work">Work</option>
                <option value="Other">Other</option>
              </select>

              <input
                placeholder="Name"
                {...register("name", { required: "Name is required" })}
                className="w-full"
              />
              {errors.name && (
                <p className="text-red-500 text-xs">{errors.name.message}</p>
              )}

              <input
                placeholder="Street"
                {...register("street", { required: "Street is required" })}
                className="w-full"
              />
              {errors.street && (
                <p className="text-red-500 text-xs">{errors.street.message}</p>
              )}

              <input
                placeholder="City"
                {...register("city", { required: "City is required" })}
                className="w-full"
              />
              {errors.city && (
                <p className="text-red-500 text-xs">{errors.city.message}</p>
              )}

              <input
                placeholder="ZIP Code"
                {...register("zip", { required: "ZIP Code is required" })}
                className="w-full"
              />
              {errors.zip && (
                <p className="text-red-500 text-xs">{errors.zip.message}</p>
              )}

              <select {...register("country")} className="form-input w-full">
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>

              <select {...register("isDefault")} className="form-input w-full">
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
