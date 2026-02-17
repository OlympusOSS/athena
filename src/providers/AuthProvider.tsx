"use client";

import { Box, CircularProgress } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { useAuthStore } from "@/features/auth/hooks/useAuth";

interface AuthProviderProps {
	children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
	const { isAuthenticated, isLoading, checkSession } = useAuthStore();
	const router = useRouter();
	const pathname = usePathname();

	// Check session on mount
	useEffect(() => {
		checkSession();
	}, [checkSession]);

	// Handle redirects after session check completes
	useEffect(() => {
		if (isLoading) return;

		if (!isAuthenticated && pathname !== "/login") {
			router.push("/login");
		}

		if (isAuthenticated && pathname === "/login") {
			router.push("/dashboard");
		}
	}, [isAuthenticated, pathname, router, isLoading]);

	// Show loading spinner during initialization
	if (isLoading) {
		return (
			<Box
				sx={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					minHeight: "100vh",
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	return <>{children}</>;
}
