import { X } from "lucide-react";
import React from "react";

const DeleteConfirmationModel = ({
  product,
  onClose,
  onConfirm,
  onRestore,
}: any) => {
  if (!product) return null;

  const isDeleted = product.isDeleted;

  return (
    <div
      className="fixed inset-0 w-full h-full bg-black/50 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="bg-black p-6 border border-gray-700 rounded-lg md:w-[450px] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-700 pb-3">
          <h3 className="text-xl text-white">
            {isDeleted ? "Restore Product" : "Delete Product"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="mt-4">
          <p className="text-gray-300">
            {isDeleted ? (
              <>
                Are you sure you want to restore{" "}
                <span className="font-semibold text-white">
                  "{product.title}"
                </span>
                ? It will be immediately visible in your shop again.
              </>
            ) : (
              <>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-white">
                  "{product.title}"
                </span>
                ?
                <br />
                It will be moved to a temporary state and permanently removed{" "}
                <span className="text-white font-medium">after 24 hours</span>.
              </>
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-md text-white cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={isDeleted ? onRestore : onConfirm}
            className={`${
              isDeleted
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            } px-4 py-2 rounded-md text-white cursor-pointer transition-colors`}
          >
            {isDeleted ? "Restore Now" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModel;
