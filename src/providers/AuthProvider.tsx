"use client";

import { Icon } from "@olympusoss/canvas";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useCheckSession, useIsAuthenticated, useIsAuthLoading } from "@/features/auth/hooks/useAuth";

interface AuthProviderProps {
	children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
	const isAuthenticated = useIsAuthenticated();
	const isLoading = useIsAuthLoading();
	const checkSession = useCheckSession();
	const router = useRouter();
	const pathname = usePathname();
	const [isInitializing, setIsInitializing] = useState(true);
	const hasCheckedSession = useRef(false);

	// Check OAuth2 session on mount (reads httpOnly cookie via /api/auth/session)
	useEffect(() => {
		if (!hasCheckedSession.current) {
			hasCheckedSession.current = true;
			checkSession();
		}
	}, [checkSession]);

	useEffect(() => {
		// Wait for auth state to be loaded
		if (!isLoading) {
			// If not authenticated and not on login page, redirect to OAuth2 login
			if (!isAuthenticated && pathname !== "/login") {
				window.location.href = "/api/auth/login";
				return;
			}

			// If authenticated and on login page, redirect to dashboard
			if (isAuthenticated && pathname === "/login") {
				router.push("/dashboard");
			}

			// Set initializing to false after initial auth check and redirects
			setIsInitializing(false);
		}
	}, [isAuthenticated, pathname, router, isLoading]);

	// Show loading spinner during initialization
	if (isLoading || isInitializing) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Icon name="loading" className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	return <>{children}</>;
}
