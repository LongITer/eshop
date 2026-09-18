import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useUser from "./useUser";

const useRequireAuth = (redirectTo = "/login") => {
  const { user, isLoading, isError, refetch } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || isError)) {
      router.push(redirectTo);
    }
  }, [user, isLoading, isError, redirectTo, router]);

  return { user, isLoading, isError, refetch };
};

export default useRequireAuth;
