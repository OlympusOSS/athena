"use client";

import { Icon } from "@olympus/canvas";
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
		<div
			className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#667eea] via-[#764ba2] via-50% to-[#4facfe]"
			style={{
				backgroundSize: "400% 400%",
				animation: "gradient 15s ease infinite",
			}}
		>
			<style jsx>{`
				@keyframes gradient {
					0% { background-position: 0% 50%; }
					50% { background-position: 100% 50%; }
					100% { background-position: 0% 50%; }
				}
			`}</style>
			<Icon name="loading" className="mb-6 h-12 w-12 animate-spin text-white" />
			<h2 className="text-lg font-medium text-white">Redirecting to login...</h2>
		</div>
	);
}
