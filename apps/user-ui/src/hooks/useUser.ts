import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../utils/axioInstance';


// Fetch user data from API
const fetchUser = async () => {
    const response = await axiosInstance.get("/api/logged-in-user");
    return response.data.user;
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
