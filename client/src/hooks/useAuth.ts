import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

interface UserWithWallet extends User {
  wallet?: {
    publicKey: string;
    balance: string;
  };
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<UserWithWallet>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
