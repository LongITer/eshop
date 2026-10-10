import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../utils/axioInstance';
import axios from 'axios';


// Fetch user data from API
const fetchUser = async () => {
    try {
        const response = await axiosInstance.get("/api/logged-in-user");
        return response.data.user;
    } catch (error) {
        // A guest or an expired session is normal; keep server/network failures visible.
        if (axios.isAxiosError(error) && error.response?.status === 401) return null;
        throw error;
    }
}

const useUser = () => {
    const {
        data: user,
        isLoading,
        isError,
        error,
        isFetching,
        refetch
    } = useQuery({
        queryKey: ["user"],
        queryFn: fetchUser,
        staleTime: 5 * 60 * 1000,
        retry: 1,
    });

    return { user, isLoading, isError, error, isFetching, refetch };
}

export default useUser;
