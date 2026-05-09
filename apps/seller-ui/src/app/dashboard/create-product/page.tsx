"use client";
import { useQuery } from "@tanstack/react-query";
import ColorSelector from "apps/seller-ui/src/shared/components/color-selector";
import ImagePlaceHolder from "apps/seller-ui/src/shared/components/image-placeholder";
import axiosInstance from "apps/seller-ui/src/utils/axioInstance";
import { ChevronRight } from "lucide-react";
import Input from "packages/components/input";
import CustomProperties from "packages/components/input/custom-properties";
import CustomSpecifications from "packages/components/input/custom-specification";
import RichTextEditor from "packages/components/rich-text-editor";
import React, { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";

const Page = () => {
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const [openImageModel, setOpenImageModel] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [images, setImages] = useState<(File | null)[]>([null]);
  const [loading, setLoading] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      try {
        const res = await axiosInstance.get("/product/api/get-categories");
        return res.data;
      } catch (error) {
        console.log(error);
      }
    },
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  const categories = data?.categories || [];
  const subCategoriesData = data?.subCategories || {};

  const selectedCategory = watch("category");
  const regularPrice = watch("regular_price");

  const subCategories = useMemo(() => {
    return selectedCategory ? subCategoriesData[selectedCategory] || [] : [];
  }, [selectedCategory, subCategoriesData]);

  const onSubmit = (data: any) => {
    console.log(data);
  };

  const handleImageChange = (file: File | null, index: number) => {
    const updatedImages = [...images];
    updatedImages[index] = file;

    if (index === images.length - 1 && images.length < 8) {
      updatedImages.push(null);
    }

    setImages(updatedImages);
    setValue("images", updatedImages);
  };

  const handleRemoveImage = (index: number) => {
    setImages((prevImages) => {
      let updatedImages = [...prevImages];
      if (index === -1) {
        updatedImages[0] = null;
      } else {
        updatedImages.splice(index, 1);
      }

      if (!updatedImages.includes(null) && updatedImages.length < 8) {
        updatedImages.push(null);
      }

      return updatedImages;
    });

    setValue("images", images);
    setIsChanged(true);
  };

  return (
    <form
      className="w-full mx-auto p-8 shadow-md rounded-lg text-white"
      onSubmit={handleSubmit(onSubmit)}
    >
      {/* Heading & Breadcrumbs */}
      <h2 className="text-2xl py-2 font-semibold font-Poppins text-while">
        Create Product
      </h2>
      <div className="flex items-center">
        <span className="text-[#80Deea] cursor-pointer">Dashboard</span>
        <ChevronRight size={20} className="opacity-[.8]" />
        <span>Create product</span>
      </div>

      {/* Content Layout*/}
      <div className="py-4 w-full flex gap-6 ">
        {/* Left side - Image upload section */}
        <div className="md:w-[35%]">
          {images?.length > 0 && (
            <ImagePlaceHolder
              setOpenImageModel={setOpenImageModel}
              size="765 × 850"
              small={false}
              index={0}
              onImageChange={handleImageChange}
              onRemove={handleRemoveImage}
            />
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            {images?.slice(1).map((_, index) => (
              <ImagePlaceHolder
                setOpenImageModel={setOpenImageModel}
                size="765 × 850"
                key={index}
                small={true}
                index={index + 1}
                onImageChange={handleImageChange}
                onRemove={handleRemoveImage}
              />
            ))}
          </div>
        </div>

        {/* Right side - form inputs*/}
        <div className="md:w-[65%]">
          <div className="w-full flex gap-6">
            {/* Product title input*/}
            <div className="w-2/4">
              {/* Title */}
              <Input
                label="Product Title *"
                placeholder="Enter product title"
                {...register("title", { required: "Title is required" })}
              />

              {errors.title && (
                <span className="text-red-500">
                  {errors.title.message as string}
                </span>
              )}

              {/* Description */}
              <div className="mt-2">
                <Input
                  rows={7}
                  cols={10}
                  label="Short description * (Max 150 words)"
                  placeholder="Enter product description"
                  type="textarea"
                  {...register("description", {
                    required: "Description is required",
                    validate: (value) => {
                      const wordCount = value.trim().split(/\s+/).length;
                      return (
                        wordCount <= 150 ||
                        `Description can't exceed more than 150 words (Current: ${wordCount})`
                      );
                    },
                  })}
                />

                {errors.description && (
                  <span className="text-red-500">
                    {errors.description.message as string}
                  </span>
                )}
              </div>

              {/* Tag */}
              <div className="mt-2">
                <Input
                  label="Tag (Max 100 words)"
                  placeholder="Apple, Flagship"
                  {...register("tag", {
                    required: "Separate related products with a coma",
                  })}
                />

                {errors.tag && (
                  <span className="text-red-500">
                    {errors.tag.message as string}
                  </span>
                )}
              </div>

              {/* Slug */}
              <div className="mt-2">
                <Input
                  label="Slug *"
                  placeholder="product_slug"
                  {...register("slug", {
                    required: "Slug is required",
                    pattern: {
                      value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                      message:
                        "Invalid slug format! Use only lowercase letters, numbers and hyphens.",
                    },
                    minLength: {
                      value: 3,
                      message: "Slug must be at least 3 characters long",
                    },
                    maxLength: {
                      value: 50,
                      message: "Slug can't be more than 50 characters",
                    },
                  })}
                />

                {errors.slug && (
                  <span className="text-red-500">
                    {errors.slug.message as string}
                  </span>
                )}
              </div>

              {/* Brand */}
              <div className="mt-2">
                <Input
                  label="Brand *"
                  placeholder="Apple"
                  {...register("brand", { required: "Brand is required" })}
                />

                {errors.brand && (
                  <span className="text-red-500">
                    {errors.brand.message as string}
                  </span>
                )}
              </div>

              {/* Color selector */}
              <div className="mt-2">
                <ColorSelector control={control} error={errors} />
              </div>

              {/* Custom specifications */}
              <div className="mt-2">
                <CustomSpecifications control={control} error={errors} />
              </div>

              {/* Custom properties */}
              <div className="mt-2">
                <CustomProperties control={control} error={errors} />
              </div>

              {/* Cash */}
              <div className="mt-2">
                <label className="block font-semibold text-gray-300 mb-1">
                  Cash on delivery *
                </label>
                <select
                  {...register("cash_on_delivery", {
                    required: "Cash on delivery is required",
                  })}
                  defaultValue="yes"
                  className="w-full border outline-none border-gray-700 bg-transparent p-2 rounded-lg"
                >
                  <option value="yes" className="bg-black">
                    Yes
                  </option>
                  <option value="no" className="bg-black">
                    No
                  </option>
                </select>

                {errors.cash_on_delivery && (
                  <span className="text-red-500">
                    {errors.cash_on_delivery.message as string}
                  </span>
                )}
              </div>
            </div>

            {/* Right Side */}
            <div className="w-2/4">
              <label className="block font-semibold text-gray-300 mb-1">
                Category *
              </label>

              {isLoading ? (
                <p className="text-gray-400">Loading categories ...</p>
              ) : isError ? (
                <p className="text-red-500">Failed to load categories</p>
              ) : (
                <Controller
                  name="category"
                  control={control}
                  rules={{ required: "Category is required" }}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="w-full border outline-none border-gray-700 bg-transparent"
                    >
                      {" "}
                      <option value="" className="bg-black">
                        Select Category
                      </option>
                      {categories.map((category: string) => (
                        <option
                          key={category}
                          value={category}
                          className="bg-black"
                        >
                          {category}
                        </option>
                      ))}
                    </select>
                  )}
                />
              )}
              {errors.category && (
                <span className="text-red-500">
                  {errors.category.message as string}
                </span>
              )}

              <div className="mt-2">
                <label className="block font-semibold text-gra-300 mb-1">
                  Subcategory *
                </label>

                <Controller
                  name="subCategory"
                  control={control}
                  rules={{ required: "Sub category is required" }}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="w-full border outline-none border-gray-700 bg-transparent"
                    >
                      {" "}
                      <option value="" className="bg-black">
                        Select Category
                      </option>
                      {subCategories.map((category: string) => (
                        <option
                          key={category}
                          value={category}
                          className="bg-black"
                        >
                          {category}
                        </option>
                      ))}
                    </select>
                  )}
                />

                {errors.subCategory && (
                  <span className="text-red-500">
                    {errors.subCategory.message as string}
                  </span>
                )}
              </div>

              <div className="mt-2">
                <label className="block font-semibold text-gray-300 mb-1">
                  Detail Description * (Min 100 words)
                </label>
                <Controller
                  name="detail_description"
                  control={control}
                  rules={{
                    required: "Detail description is required",
                    validate: (value) => {
                      const wordCount = value?.trim().split(/\s+/).length;
                      return (
                        wordCount >= 100 ||
                        "Detail description must be at least 100 words"
                      );
                    },
                  }}
                  render={({ field }) => (
                    <RichTextEditor
                      value={field.value || ""}
                      onChange={(content) => field.onChange(content)}
                    />
                  )}
                />
                {errors.detail_description && (
                  <span className="text-red-500">
                    {errors.detail_description.message as string}
                  </span>
                )}
              </div>

              <div className="mt-2">
                <Input
                  label="Video URL"
                  placeholder="https://www.youtube.com/embed/xyz123"
                  {...register("video_url", {
                    pattern: {
                      value:
                        /^https:\/\/ (www\.)?youtube\.com\/embed\/[a-zA-Z0-9_-]+$/,
                      message:
                        "Invalid Youtube embed URL. Use Format: https://www.youtube.com/embed/xyz123",
                    },
                  })}
                />
                {errors.video_url && (
                  <span className="text-red-500">
                    {errors.video_url.message as string}
                  </span>
                )}
              </div>

              <div className="mt-2">
                <Input
                  label="Regular price"
                  placeholder="20$"
                  {...register("regular_price", {
                    required: "Regular price is required",
                    valueAsNumber: true,
                    min: { value: 1, message: "Price must be at least 1" },
                    validate: (value) =>
                      !isNaN(value) || "Please enter a valid number",
                  })}
                />
                {errors.regular_price && (
                  <span className="text-red-500">
                    {errors.regular_price.message as string}
                  </span>
                )}
              </div>

              <div className="mt-2">
                <Input
                  label="Sale price"
                  placeholder="15$"
                  {...register("sale_price", {
                    required: "Sale price is required",
                    valueAsNumber: true,
                    min: { value: 1, message: "Price must be at least 1" },
                    validate: (value) => {
                      !isNaN(value) || "Please enter a valid number";
                      if (regularPrice && value >= regularPrice) {
                        return "Sale price must be less than regular price";
                      }
                    },
                  })}
                />
                {errors.regular_price && (
                  <span className="text-red-500">
                    {errors.regular_price.message as string}
                  </span>
                )}
              </div>

              <div className="mt-2">
                <Input
                  label="Stock *"
                  placeholder="100"
                  {...register("stock", {
                    required: "Stock is required",
                    valueAsNumber: true,
                    min: { value: 1, message: "Stock must be at least 1" },
                    max: { value: 10000, message: "Stock cannot exceed 1000" },
                    validate: (value) => {
                      if (isNaN(value)) return "Please enter a valid number";
                      if (!Number.isInteger(value))
                        return "Stock must be a whole number";
                      return true;
                    },
                  })}
                />
                {errors.stock && (
                  <span className="text-red-500">
                    {errors.stock.message as string}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

export default Page;
