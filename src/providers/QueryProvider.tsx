import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { type ReactNode, useState } from "react";

interface QueryProviderProps {
	children: ReactNode;
}

/**
 * Provider for React Query with default settings
 */
export function QueryProvider({ children }: QueryProviderProps) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 1000 * 60 * 5, // 5 minutes
						retry: 1,
						refetchOnWindowFocus: false,
					},
				},
			}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			{children}
			{/* c8 ignore start -- ReactQueryDevtools renders only when NODE_ENV === "development";
			 * Vitest runs with NODE_ENV="test", so this branch is never taken in coverage runs. */}
			{process.env.NODE_ENV === "development" && <ReactQueryDevtools />}
			{/* c8 ignore stop */}
		</QueryClientProvider>
	);
}
