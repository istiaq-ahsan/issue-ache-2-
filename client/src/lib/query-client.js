import { QueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) =>
        failureCount < 2 && (!error?.apiStatus || error.apiStatus >= 500),
    },
    mutations: {
      retry: false,
    },
  },
})

export default queryClient
