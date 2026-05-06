import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import React from 'react'
import { useForm } from 'react-hook-form';
import { shopCategories } from '../../utils/categories';
import { ShopFormData } from '../types/shop';
import toast from 'react-hot-toast';

const CreateShop = ({
    sellerId,
    setActiveStep
}: {
    sellerId: string;
    setActiveStep: (step: number) => void;
}) => {
    const { register, handleSubmit, formState: { errors } } = useForm<ShopFormData>();
    const countWords = (text: string) => text.trim().split(/\s+/).length;

    const shopCreateMutation = useMutation({
        mutationFn: async (data: ShopFormData & { sellerId: string }) => {
            const response = await axios.post(`/api/create-shop`, data);
            return response.data;
        },
        onSuccess: (data) => {
            setActiveStep(3);
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to create shop");
        }
    })

    const onSubmit = (data: ShopFormData) => {
        const shopData = { ...data, sellerId };
        shopCreateMutation.mutate(shopData);
    }

    return (
        <div>
            <form onSubmit={handleSubmit(onSubmit)}>
                <h3 className='text-2xl font-semibold text-center mb-4'>
                    Setup a new shop
                </h3>
                {/* Shop Name */}
                <label className='block text-gray-700 mb-1'>Shop Name *</label>
                <input type="text" placeholder='Shop name'
                    className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                    {...register("name", { required: "Shop name is required" })}
                />
                {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}

                {/* Bio */}
                <label className='block text-gray-700 mb-1'>Bio (Max 100 words) *</label>
                <textarea placeholder='Bios' cols={10} rows={4}
                    className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                    {...register("bio", {
                        required: "Shop bio is required",
                        validate: (value) => countWords(value) <= 100 || "Bio must be at most 100 words"
                    })}
                />
                {errors.bio && <p className='text-red-500 text-sm'>{errors.bio.message}</p>}

                {/* Address */}
                <label className='block text-gray-700 mb-1'>Address *</label>
                <input type="text" placeholder='Shop address'
                    className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                    {...register("address", { required: "Shop address is required" })}
                />
                {errors.address && <p className='text-red-500 text-sm'>{errors.address.message}</p>}

                {/* opening hours */}
                <label className='block text-gray-700 mb-1'>Opening Hours *</label>
                <input type="text" placeholder='e.g. Mon-Fri 9am-5pm'
                    className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                    {...register("opening_hours", { required: "Shop opening hours is required" })}
                />
                {errors.opening_hours && <p className='text-red-500 text-sm'>{errors.opening_hours.message}</p>}

                {/* Website */}
                <label className='block text-gray-700 mb-1'>Website</label>
                <input type="text" placeholder='https://example.com'
                    className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                    {...register("website", {
                        pattern: {
                            value: /^(https?:\/\/)?([\w\d-]+\.)+\w{2,}(\/.*)?$/,
                            message: "Invalid URL format"
                        }
                    })}
                />
                {errors.website && <p className='text-red-500 text-sm'>{errors.website.message}</p>}

                {/* Category */}
                <label className='block text-gray-700 mb-1'>Category</label>
                <select className='w-full p-2 border border-gray-300 outline-0 rounded mb-1'
                    {...register("category", { required: "Category is required" })}
                >
                    <option value="">Select a category</option>
                    {shopCategories.map((category) => (
                        <option key={category.label} value={category.value}>{category.label}</option>
                    ))}
                </select>
                {errors.category && <p className='text-red-500 text-sm'>{errors.category.message}</p>}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={shopCreateMutation.isPending}
                    className='w-full bg-blue-500 text-white p-2 rounded mt-4 mb-1'
                >
                    {shopCreateMutation.isPending ? 'Creating shop...' : 'Create Shop'}
                </button>
            </form>
        </div>
    )
}

export default CreateShop
