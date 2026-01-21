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
                        staleTime: 5 * 60 * 1000, // 5 minutes - longer stale time prevents unnecessary refetches
                        gcTime: 10 * 60 * 1000, // 10 minutes - garbage collection time (formerly cacheTime)
                        refetchOnWindowFocus: false, // Prevent refetch on window focus
                        refetchOnMount: false, // Use cached data on mount if available
                        retry: 1, // Only retry once to prevent stuck loading states
                        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000), // Exponential backoff with 3s max
                    },
                    mutations: {
                        retry: 0, // Don't retry mutations automatically
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
