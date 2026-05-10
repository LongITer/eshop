import { X } from "lucide-react";
import React from "react";

const DeleteDiscountCodeModal = ({
  discount,
  onClose,
  onConfirm,
}: {
  discount: any;
  onClose: () => void;
  onConfirm?: () => void;
}) => {
  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center">
      <div className="bg-black p-6 border border-gray-700 rounded-lg w-[450px] shadow-lg">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-700 pb-3">
          <h3 className="text-xl text-white">Delete discount code</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>
        {/* Content */}

        <p className="text-gray-300 mt-4">
          Are you sure to delete discount code{" "}
          <span className="font-semibold text-white">
            {" "}
            {discount?.public_name}
          </span>
          ?
          <br />
          This action cannot be undone.
        </p>

        {/* Action button */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-md text-white cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md text-white cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteDiscountCodeModal;
