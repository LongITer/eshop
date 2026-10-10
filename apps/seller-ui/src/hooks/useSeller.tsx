import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../utils/axioInstance';
import axios from 'axios';


// Fetch user data from API
const fetchUser = async () => {
    try {
        const response = await axiosInstance.get("/api/logged-in-seller");
        return response.data.seller;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) return null;
        throw error;
    }
}

const useSeller = () => {
    const {
        data: seller,
        isLoading,
        isError,
        refetch
    } = useQuery({
        queryKey: ["seller"],
        queryFn: fetchUser,
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });

    return { seller, isLoading, isError, refetch };
}

export default useSeller;
