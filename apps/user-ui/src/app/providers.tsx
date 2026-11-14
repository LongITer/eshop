'use client'
import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ShoppingSync from '@/shared/components/shopping-sync';
import { StorefrontLanguageProvider } from '@packages/components/storefront-language';

const Providers = ({ children }: { children: React.ReactNode }) => {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false,
                staleTime: 1000 * 60 * 5, // 5 minutes
            }
        }
    }));
    return (
        <QueryClientProvider client={queryClient}>
            <StorefrontLanguageProvider><ShoppingSync>{children}</ShoppingSync></StorefrontLanguageProvider>
        </QueryClientProvider>
    )
}

export default Providers
