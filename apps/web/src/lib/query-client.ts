import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0, // Always refetch on navigation
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
