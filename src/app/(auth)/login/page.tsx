"use client";

import { AuthLayout, Icon, LoadingState } from "@olympusoss/canvas";
import { useEffect, useRef } from "react";
import { useLogin } from "@/features/auth/hooks/useAuth";

export default function LoginPage() {
	const login = useLogin();
	const hasRedirected = useRef(false);

	// Immediately redirect to OAuth2 login flow
	useEffect(() => {
		if (!hasRedirected.current) {
			hasRedirected.current = true;
			login();
		}
	}, [login]);

	return (
		<AuthLayout>
			<LoadingState variant="page" message="Redirecting to login..." />
		</AuthLayout>
	);
}
