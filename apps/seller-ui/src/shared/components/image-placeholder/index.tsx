import { Pencil, WandSparkles, X } from "lucide-react";
import Image from "next/image";
import React, { useState } from "react";

const ImagePlaceHolder = ({
  size,
  small,
  onImageChange,
  pictureUploadingLoader,
  onRemove,
  defaultImage = null,
  index = null,
  images,
  setSelectedImage,
  setOpenImageModel,
}: {
  size: string;
  small?: boolean;
  pictureUploadingLoader: boolean;
  onImageChange: (file: File | null, index: number) => void;
  onRemove?: (index: number) => void;
  defaultImage?: string | null;
  setSelectedImage: (value: any) => void;

  images?: any;
  setOpenImageModel?: (openImageModel: boolean) => void;
  index?: any;
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(defaultImage);

  React.useEffect(() => {
    setImagePreview(defaultImage);
  }, [defaultImage]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
      onImageChange(file, index!);
      // Reset the value so the same file can be selected again if deleted
      event.target.value = "";
    }
  };

  return (
    <div
      className={`relative aspect-square w-full cursor-pointer bg-[#1e1e1e] border border-gray-600 rounded-lg flex flex-col justify-center items-center`}
    >
      <input
        type="file"
        accept="image/*"
        className="hidden"
        id={`image-upload-${index}`}
        onChange={handleFileChange}
      />
      {imagePreview ? (
        <>
          <button
            type="button"
            disabled={pictureUploadingLoader}
            onClick={() => onRemove?.(index!)}
            className="absolute top-3 right-2 p-2 !rounded bg-red-600 shadow-lg"
          >
            <X size={16} />
          </button>
          <button
            type="button"
            disabled={pictureUploadingLoader}
            className="absolute top-3 right-[70px] p-2 rounded bg-blue-500 shadow-lg cursor-pointer"
            onClick={() => {
              setOpenImageModel?.(true);
              setSelectedImage(defaultImage);
            }}

          >
            <WandSparkles size={16} />
          </button>
        </>
      ) : (
        <label
          htmlFor={`image-upload-${index}`}
          className="absolute top-3 right-3 p-2 !rounded bg-slate-700 shadow-lg cursor-pointer"
        >
          <Pencil size={16} />
        </label>
      )}

      {imagePreview ? (
        <Image
          width={400}
          height={400}
          src={imagePreview}
          alt="Uploaded"
          unoptimized
          className="w-full h-full object-cover rounded-lg "
        />
      ) : (
        <>
          <p
            className={`text-gray-400 ${small ? "text-xl" : "text-4xl"} font-semibold`}
          >
            {size}
          </p>
          <p
            className={`text-gray-400 ${small ? "text-sm" : "text-lg"} pt-2 text-center`}
          >
            Please choose an image <br />
            according to the expected ratio
          </p>
        </>
      )}
    </div>
  );
};

export default ImagePlaceHolder;
