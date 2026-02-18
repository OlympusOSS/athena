"use client";

import { Box, CircularProgress, Typography } from "@mui/material";
import { useEffect, useRef } from "react";
import { useLogin } from "@/features/auth/hooks/useAuth";
import { gradientColors } from "@/theme";

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
		<Box
			sx={{
				minHeight: "100vh",
				background: `linear-gradient(135deg, ${gradientColors.primary} 0%, ${gradientColors.secondary} 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)`,
				backgroundSize: "400% 400%",
				animation: "gradient 15s ease infinite",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				"@keyframes gradient": {
					"0%": { backgroundPosition: "0% 50%" },
					"50%": { backgroundPosition: "100% 50%" },
					"100%": { backgroundPosition: "0% 50%" },
				},
			}}
		>
			<CircularProgress size={48} sx={{ color: "white", mb: 3 }} />
			<Typography variant="h6" sx={{ color: "white", fontWeight: 500 }}>
				Redirecting to login...
			</Typography>
		</Box>
	);
}
