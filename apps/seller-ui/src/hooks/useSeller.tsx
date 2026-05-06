import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../utils/axioInstance';


// Fetch user data from API
const fetchUser = async () => {
    const response = await axiosInstance.get("/api/logged-in-seller");
    return response.data.seller;
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