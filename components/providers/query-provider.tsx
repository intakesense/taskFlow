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
                        staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh, no refetch needed (realtime handles updates)
                        gcTime: 10 * 60 * 1000, // 10 minutes - keep cache longer for instant navigation
                        refetchOnWindowFocus: false, // Prevent refetch on window focus
                        refetchOnMount: false, // CRITICAL: Don't refetch if data exists - realtime handles updates
                        refetchOnReconnect: true, // Refetch when reconnecting to sync latest data
                        retry: 1, // Only retry once to prevent stuck loading states
                        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000), // Exponential backoff with 3s max
                        networkMode: 'offlineFirst', // Use cache first, network if available - works with Realtime for sync
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
