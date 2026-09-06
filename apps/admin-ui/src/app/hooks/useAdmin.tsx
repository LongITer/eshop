import { useRouter } from "next/navigation";
import axiosInstance from "../../utils/axioInstance";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

const fetchAdmin = async () => {
    const response = await axiosInstance.get("/api/logged-in-admin");
    return response.data.user;
};

const useAdmin = () => {
    const {
        data: admin,
        isLoading,
        isError,
        refetch,
    }= useQuery({
        queryKey: ["admin"],
        queryFn: fetchAdmin,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        retry: 1
    });

    return { admin, isLoading, isError, refetch };
}

export default useAdmin;