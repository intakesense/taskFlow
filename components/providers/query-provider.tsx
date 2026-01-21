'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode, useState } from 'react';

interface QueryProviderProps {
    children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 minute - shorter to allow fresh data on hard refresh
                        gcTime: 5 * 60 * 1000, // 5 minutes - garbage collection time (formerly cacheTime)
                        refetchOnWindowFocus: false, // Prevent refetch on window focus
                        refetchOnMount: true, // Always refetch on mount to get fresh data
                        refetchOnReconnect: true, // Refetch when reconnecting
                        retry: 1, // Only retry once to prevent stuck loading states
                        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000), // Exponential backoff with 3s max
                        networkMode: 'offlineFirst', // Try cached data first, but handle online/offline properly
                    },
                    mutations: {
                        retry: 0, // Don't retry mutations automatically
                        networkMode: 'online', // Mutations require network
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
