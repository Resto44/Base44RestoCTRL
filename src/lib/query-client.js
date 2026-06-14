import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch when user switches tabs — reduces unnecessary API calls
      refetchOnWindowFocus: false,
      // Retry once on failure
      retry: 1,
      // Default stale time: 2 minutes — most restaurant data doesn't change that fast
      staleTime: 2 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
    },
    mutations: {
      // Don't retry mutations — they may have side effects
      retry: 0,
    },
  },
});