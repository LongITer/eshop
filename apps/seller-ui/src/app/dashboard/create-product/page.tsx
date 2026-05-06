"use client";
import ColorSelector from "apps/seller-ui/src/shared/components/color-selector";
import ImagePlaceHolder from "apps/seller-ui/src/shared/components/image-placeholder";
import { ChevronRight } from "lucide-react";
import Input from "packages/components/input";
import CustomSpecifications from "packages/components/input/custom-specification";
import React, { useState } from "react";
import { useForm } from "react-hook-form";

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

              <div className="mt-2">
                <CustomSpecifications control={control} error={errors} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

export default Page;
