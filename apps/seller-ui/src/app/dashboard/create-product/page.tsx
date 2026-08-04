"use client";
import { useQuery } from "@tanstack/react-query";
import ColorSelector from "apps/seller-ui/src/shared/components/color-selector";
import ImagePlaceHolder from "apps/seller-ui/src/shared/components/image-placeholder";
import axiosInstance from "apps/seller-ui/src/utils/axioInstance";
import { ChevronRight, Wand, X } from "lucide-react";
import Input from "packages/components/input";
import CustomProperties from "packages/components/input/custom-properties";
import CustomSpecifications from "packages/components/input/custom-specification";
import dynamic from "next/dynamic";
const RichTextEditor = dynamic(
  () => import("packages/components/rich-text-editor"),
  { ssr: false },
);

import SizeSelector from "packages/components/size-selector";
import React, { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import Image from "next/image";
import { enhancements } from "apps/seller-ui/src/utils/AI.enhancement";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [pictureUploadingLoader, setPictureUploadingLoader] = useState(false);
  const [isChanged, setIsChanged] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const router = useRouter();
  const [images, setImages] = useState<
    (File | { url: string; fileId: string } | null)[]
  >([null]);

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

  const { data: discountCodes = [], isLoading: discountLoading } = useQuery({
    queryKey: ["shop-discounts"],
    queryFn: async () => {
      const res = await axiosInstance.get("/product/api/get-discount-code");
      return res?.data?.discount_codes || [];
    },
  });

  const categories = data?.categories || [];
  const subCategoriesData = data?.subCategories || {};

  const selectedCategory = watch("category");
  const regularPrice = watch("regular_price");

  const subCategories = useMemo(() => {
    return selectedCategory ? subCategoriesData[selectedCategory] || [] : [];
  }, [selectedCategory, subCategoriesData]);

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);
      await axiosInstance.post("/product/api/create-product", data);
      router.push("/dashboard/all-products");
    } catch (error: any) {
      console.error("Create product error:", error.response?.data || error);
      toast.error(error.response?.data?.message || "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  const convertToBase64 = async (file: File) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageChange = async (file: File | null, index: number) => {
    if (!file) return;

    try {
      const fileName = await convertToBase64(file);
      setPictureUploadingLoader(true);
      const response = await axiosInstance.post(
        "/product/api/upload-product-image",
        { fileName },
      );

      const updatedImages = [...images];
      updatedImages[index] = {
        url: response.data.file_url,
        fileId: response.data.fileName,
      };

      if (index === images.length - 1 && images.length < 8) {
        updatedImages.push(null);
      }

      setImages(updatedImages);
      setValue("images", updatedImages);
    } catch (error) {
      console.log(error);
    } finally {
      setPictureUploadingLoader(false);
    }
  };

  const handleRemoveImage = async (index: number) => {
    try {
      const updatedImages = [...images];
      const imageToDelete = updatedImages[index];

      if (
        imageToDelete &&
        typeof imageToDelete === "object" &&
        "fileId" in imageToDelete
      ) {
        // Delete our image
        await axiosInstance.delete("/product/api/delete-product-image", {
          data: {
            fileId: imageToDelete.fileId,
          },
        });
      }

      updatedImages.splice(index, 1);

      // Add null placeholder
      if (!updatedImages.includes(null) && updatedImages.length < 8) {
        updatedImages.push(null);
      }

      setImages(updatedImages);
      setValue("images", updatedImages);
    } catch (error) {
      console.log(error);
    }
  };

  const applyTransformation = async (transformation: string) => {
    if (!selectedImage || processing) return;
    setProcessing(true);
    setImageLoading(true);
    setActiveEffect(transformation);

    try {
      // Use URL object for more robust parsing if possible, fallback to string split
      let baseUrl = "";
      let params = new URLSearchParams();

      if (selectedImage.startsWith("http")) {
        const url = new URL(selectedImage);
        baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
        params = new URLSearchParams(url.search);
      } else {
        const [path, query] = selectedImage.split("?");
        baseUrl = path;
        params = new URLSearchParams(query || "");
      }

      let currentTr = params.get("tr") || "";

      if (currentTr) {
        const effects = currentTr.split(",");
        if (!effects.includes(transformation)) {
          currentTr = `${currentTr},${transformation}`;
        }
      } else {
        currentTr = transformation;
      }

      params.set("tr", currentTr);
      // Construct URL manually to ensure commas are not double-encoded if necessary,
      // but decoded string is usually safest for ImageKit.
      const transformedUrl = `${baseUrl}?${decodeURIComponent(params.toString())}`;
      setSelectedImage(transformedUrl);
    } catch (error) {
      console.error("Transformation error:", error);
    } finally {
      setProcessing(false);
      setActiveEffect(null);
    }
  };

  const handleSaveEnhancedImage = () => {
    if (editingIndex !== null && selectedImage) {
      setImages((prevImages) => {
        const updatedImages = [...prevImages];
        const currentImage = updatedImages[editingIndex];

        // Ensure we are updating an existing image object with a URL
        if (
          currentImage &&
          typeof currentImage === "object" &&
          "url" in currentImage
        ) {
          updatedImages[editingIndex] = {
            ...currentImage,
            url: selectedImage,
          };
        }
        return updatedImages;
      });

      // Also update react-hook-form
      const currentImages = [...images];
      const img = currentImages[editingIndex];
      if (img && typeof img === "object" && "url" in img) {
        currentImages[editingIndex] = { ...img, url: selectedImage };
        setValue("images", currentImages);
      }

      setOpenImageModel(false);
      setEditingIndex(null);
    }
  };

  const handleSaveDraft = () => {};

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
              defaultImage={
                images[0] && typeof images[0] === "object" && "url" in images[0]
                  ? images[0].url
                  : null
              }
              setOpenImageModel={(open) => {
                setOpenImageModel(open);
                if (open) {
                  setEditingIndex(0);
                  setImageLoading(true);
                }
              }}
              size="765 × 850"
              small={false}
              pictureUploadingLoader={pictureUploadingLoader}
              index={0}
              images={images}
              onImageChange={handleImageChange}
              setSelectedImage={setSelectedImage}
              onRemove={handleRemoveImage}
            />
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            {images?.slice(1).map((img, index) => (
              <ImagePlaceHolder
                defaultImage={
                  img && typeof img === "object" && "url" in img
                    ? img.url
                    : null
                }
                setOpenImageModel={(open) => {
                  setOpenImageModel(open);
                  if (open) {
                    setEditingIndex(index + 1);
                    setImageLoading(true);
                  }
                }}
                size="765 × 850"
                pictureUploadingLoader={pictureUploadingLoader}
                key={
                  img && typeof img === "object" && "url" in img
                    ? img.url
                    : typeof img === "string"
                      ? img
                      : index
                }
                small={true}
                setSelectedImage={setSelectedImage}
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
                  {...register("short_description", {
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

              {/* Warranty */}
              <div className="mt-2">
                <Input
                  label="Warranty *"
                  placeholder="1 Year Warranty"
                  {...register("warranty", { required: "Warranty is required" })}
                />

                {errors.warranty && (
                  <span className="text-red-500">
                    {errors.warranty.message as string}
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
                  Detail Description * (Min 20 words)
                </label>
                <Controller
                  name="detail_description"
                  control={control}
                  rules={{
                    required: "Detail description is required",
                    validate: (value) => {
                      const text = value?.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ') || '';
                      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
                      return (
                        wordCount >= 20 ||
                        "Detail description must be at least 20 words"
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
                  placeholder="https://www.youtube.com/watch?v=xyz123"
                  {...register("video_url", {
                    pattern: {
                      value:
                        /^https:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]+/,
                      message:
                        "Invalid Youtube URL. Please provide a valid YouTube link",
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
                    max: {
                      value: 10000,
                      message: "Stock cannot exceed 1000",
                    },
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

              <div className="mt-2">
                <SizeSelector control={control} errors={errors} />
              </div>

              <div className="mt-3">
                <label className="block font-semibold text-gray-300 mb-1">
                  Select Discount Code (optional)
                </label>

                {discountLoading ? (
                  <p className="text-gray-400">Loading discount codes</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {discountCodes?.map((code: any) => (
                      <button
                        key={code.id}
                        type="button"
                        className={`px-3 py-4 rounded-md text-sm font-semibold border ${watch("discountCodes")?.includes(code.id) ? "bg-blue-600 text-white border-blue-600" : "bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700"}`}
                        onClick={() => {
                          const currentSelection = watch("discountCodes") || [];
                          const updatedSelection = currentSelection?.includes(
                            code.id,
                          )
                            ? currentSelection.filter(
                                (id: string) => id !== code.id,
                              )
                            : [...currentSelection, code.id];
                          setValue("discountCodes", updatedSelection);
                        }}
                      >
                        {code?.public_name} ({code?.discountValue}
                        {code?.discountType === "percentage" ? "%" : "$"})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {openImageModel && (
        <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-[450px] text-white">
            <div className="flex justify-between items-center pb-3 mb-4">
              <h2 className="text-lg font-semibold">Enhance Product Images</h2>
              <X
                size={20}
                className="cursor-pointer"
                onClick={() => setOpenImageModel(false)}
              />
            </div>
            <div className="w-full h-[250px] relative rounded-md overflow-hidden border border-gray-600 bg-black/20">
              {selectedImage && (
                <Image
                  src={selectedImage}
                  alt="product-image"
                  fill
                  unoptimized
                  onLoad={() => setImageLoading(false)}
                  className={`object-cover transition-opacity duration-300 ${processing || imageLoading ? "opacity-30 blur-sm" : "opacity-100"}`}
                />
              )}
              {(processing || imageLoading) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                  <p className="text-xs text-blue-400 font-medium animate-pulse">
                    Processing with AI...
                  </p>
                </div>
              )}
            </div>
            {selectedImage && (
              <div className="mt-4 space-y-2">
                <h3 className="text-white text-sm font-semibold">
                  AI Enhancements
                </h3>
                <div className="grid grid-cols-2 gap-3 mx-h-[250px] overflow-y-auto">
                  {enhancements?.map(({ label, effect }) => (
                    <button
                      key={effect}
                      type="button"
                      onClick={() => applyTransformation(effect)}
                      disabled={processing}
                      className={`p-2 rounded-md flex items-center gap-2 ${activeEffect === effect ? "bg-blue-600 text-white " : "bg-gray-700 hover:bg-gray-600"}`}
                    >
                      <Wand size={18} />
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleSaveEnhancedImage}
                  className="w-full mt-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Apply Enhancement
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        {isChanged && (
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-4 py-2 bg-gray-700 text-white rounded-md"
          >
            Save Draft
          </button>
        )}

        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md"
          disabled={isLoading}
        >
          {isLoading ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
};

export default Page;
