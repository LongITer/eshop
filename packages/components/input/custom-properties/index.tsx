import React, { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import Input from "..";
import { Plus, X } from "lucide-react";

const CustomProperties = ({ control, error }: any) => {
  const [properties, setProperties] = useState<
    { label: string; values: string[] }[]
  >([]);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState<{ [key: number]: string }>({});

  return (
    <div className="w-full">
      <Controller
        name="customProperties"
        control={control}
        render={({ field }) => {
          useEffect(() => {
            field.onChange(properties);
          }, [properties]);

          const addProperty = () => {
            if (!newLabel.trim()) return;
            setProperties([...properties, { label: newLabel, values: [] }]);
            setNewLabel("");
          };

          const addValue = (index: number) => {
            const val = newValue[index];
            if (!val || !val.trim()) return;

            const updatedProperties = [...properties];
            updatedProperties[index].values.push(val.trim());
            setProperties(updatedProperties);

            setNewValue({ ...newValue, [index]: "" });
          };

          const removeProperty = (index: number) => {
            setProperties(properties.filter((_, i) => i !== index));
          };

          const removeValue = (propIndex: number, valIndex: number) => {
            const updated = [...properties];
            updated[propIndex].values = updated[propIndex].values.filter(
              (_, i) => i !== valIndex,
            );
            setProperties(updated);
          };

          return (
            <div className="mt-2 space-y-4">
              <label className="block font-semibold text-gray-300 mb-1">
                Custom Properties
              </label>

              {/* Add new Properties */}
              <div className="flex items-center gap-2 bg-gray-800 p-3 bg-transparent rounded-lg border border-gray-600">
                <Input
                  placeholder="Enter property label (e.g., Material, Warranty)"
                  value={newLabel}
                  onChange={(e: any) => setNewLabel(e.target.value)}
                />
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1 whitespace-nowrap"
                  onClick={addProperty}
                >
                  <Plus size={18} /> Add
                </button>
              </div>

              {/* List of properties */}
              <div className="grid grid-cols-1 gap-4">
                {properties.map((property, index) => (
                  <div
                    key={index}
                    className="border border-gray-700 p-4 bg-transparent rounded-lg flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                      <span className="text-blue-400 font-bold uppercase text-sm tracking-wider">
                        {property.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeProperty(index)}
                        className="text-gray-500 hover:text-red-500 transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Values */}
                    <div className="flex flex-wrap gap-2">
                      {property.values.map((val, vIndex) => (
                        <span
                          key={vIndex}
                          className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-gray-200 rounded-md text-xs border border-gray-700"
                        >
                          {val}
                          <X
                            size={12}
                            className="cursor-pointer hover:text-red-400"
                            onClick={() => removeValue(index, vIndex)}
                          />
                        </span>
                      ))}
                    </div>

                    {/* Add new values for this property */}
                    <div className="flex items-center gap-2 w-full mt-1">
                      {" "}
                      {/* Sử dụng margin âm -mt-1 để đẩy lên trên */}
                      <input
                        type="text"
                        placeholder=" Enter value..."
                        className="flex w-full items-center gap-2 outline-none bg-gray-800 px-2 py-1 rounded-lg border border-gray-600"
                        value={newValue[index] || ""}
                        onChange={(e) =>
                          setNewValue({ ...newValue, [index]: e.target.value })
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), addValue(index))
                        }
                      />
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1 whitespace-nowrap text-xs font-medium transition-colors"
                        onClick={() => addValue(index)}
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }}
      />

      {error?.customProperties && (
        <p className="text-red-500 text-sm mt-1">
          {error.customProperties.message}
        </p>
      )}
    </div>
  );
};

export default CustomProperties;
