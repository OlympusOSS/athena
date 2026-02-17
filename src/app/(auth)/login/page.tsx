"use client";

import { Visibility, VisibilityOff } from "@mui/icons-material";
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Container,
	FormControl,
	IconButton,
	InputAdornment,
	InputLabel,
	OutlinedInput,
	Paper,
	TextField,
	Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthError, useClearError, useLogin } from "@/features/auth/hooks/useAuth";
import { getIamKratosFrontendApi } from "@/services/iam-kratos";
import { APP_TITLE } from "@/lib/constants";
import { gradientColors, gradients } from "@/theme";

export default function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [localError, setLocalError] = useState("");
	const [loading, setLoading] = useState(false);
	const [flowId, setFlowId] = useState<string | null>(null);
	const [csrfToken, setCsrfToken] = useState<string | null>(null);
	const hasInitializedFlow = useRef(false);

	const login = useLogin();
	const authError = useAuthError();
	const clearError = useClearError();
	const router = useRouter();

	// Create a Kratos login flow on mount to get a CSRF token
	const initLoginFlow = useCallback(async () => {
		try {
			const api = getIamKratosFrontendApi();
			const { data: flow } = await api.createBrowserLoginFlow();
			setFlowId(flow.id);

			// Extract CSRF token from flow UI nodes
			const csrfNode = flow.ui.nodes.find(
				(node) => "attributes" in node && "name" in node.attributes && node.attributes.name === "csrf_token",
			);
			if (csrfNode && "attributes" in csrfNode && "value" in csrfNode.attributes) {
				setCsrfToken(csrfNode.attributes.value as string);
			}
		} catch (error) {
			console.error("Failed to create login flow:", error);
			setLocalError("Failed to initialize login. Please refresh the page.");
		}
	}, []);

	useEffect(() => {
		if (!hasInitializedFlow.current) {
			hasInitializedFlow.current = true;
			initLoginFlow();
		}
	}, [initLoginFlow]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearError();
		setLocalError("");

		if (!email || !password) {
			setLocalError("Please enter both email and password");
			return;
		}

		if (!flowId || !csrfToken) {
			setLocalError("Login flow not ready. Please refresh the page.");
			return;
		}

		setLoading(true);

		try {
			const success = await login(flowId, csrfToken, email, password);

			if (success) {
				router.push("/dashboard");
			} else {
				// Re-create flow since the old one is consumed after a failed attempt
				await initLoginFlow();
			}
		} catch (err) {
			setLocalError("An error occurred during login");
			console.error(err);
			// Re-create flow on error too
			await initLoginFlow();
		} finally {
			setLoading(false);
		}
	};

	const handleClickShowPassword = () => {
		setShowPassword(!showPassword);
	};

	const displayError = localError || authError;

	return (
		<Box
			sx={{
				minHeight: "100vh",
				background: `linear-gradient(135deg, ${gradientColors.primary} 0%, ${gradientColors.secondary} 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)`,
				backgroundSize: "400% 400%",
				animation: "gradient 15s ease infinite",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				position: "relative",
				overflow: "hidden",
				"@keyframes gradient": {
					"0%": { backgroundPosition: "0% 50%" },
					"50%": { backgroundPosition: "100% 50%" },
					"100%": { backgroundPosition: "0% 50%" },
				},
				"@keyframes float": {
					"0%, 100%": { transform: "translateY(0px)" },
					"50%": { transform: "translateY(-20px)" },
				},
				"@keyframes fadeInUp": {
					"0%": { opacity: 0, transform: "translateY(30px)" },
					"100%": { opacity: 1, transform: "translateY(0)" },
				},
				"&::before": {
					content: '""',
					position: "absolute",
					width: "500px",
					height: "500px",
					background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
					borderRadius: "50%",
					top: "-250px",
					left: "-250px",
					animation: "float 6s ease-in-out infinite",
				},
				"&::after": {
					content: '""',
					position: "absolute",
					width: "400px",
					height: "400px",
					background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)",
					borderRadius: "50%",
					bottom: "-200px",
					right: "-200px",
					animation: "float 8s ease-in-out infinite",
					animationDelay: "2s",
				},
			}}
		>
			<Container component="main" maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
				<Paper
					elevation={0}
					sx={{
						p: 5,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						width: "100%",
						borderRadius: 4,
						background: "rgba(255, 255, 255, 0.95)",
						backdropFilter: "blur(20px)",
						boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
						border: "1px solid rgba(255, 255, 255, 0.18)",
						animation: "fadeInUp 0.8s ease-out",
					}}
				>
					<Typography
						component="h1"
						variant="h3"
						gutterBottom
						sx={{
							fontWeight: 800,
							background: gradients.text,
							backgroundClip: "text",
							WebkitBackgroundClip: "text",
							WebkitTextFillColor: "transparent",
							mb: 1,
						}}
					>
						{APP_TITLE}
					</Typography>
					<Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontWeight: 500 }}>
						Sign in to your account
					</Typography>

					{displayError && (
						<Alert severity="error" sx={{ width: "100%", mb: 3 }}>
							{displayError}
						</Alert>
					)}

					<Box component="form" onSubmit={handleSubmit} sx={{ width: "100%" }}>
						<TextField
							margin="normal"
							required
							fullWidth
							id="email"
							label="Email"
							name="email"
							type="email"
							autoComplete="email"
							autoFocus
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={loading}
						/>
						<FormControl variant="outlined" margin="normal" required fullWidth>
							<InputLabel htmlFor="password">Password</InputLabel>
							<OutlinedInput
								id="password"
								type={showPassword ? "text" : "password"}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={loading}
								autoComplete="current-password"
								endAdornment={
									<InputAdornment position="end">
										<IconButton aria-label="toggle password visibility" onClick={handleClickShowPassword} edge="end">
											{showPassword ? <VisibilityOff /> : <Visibility />}
										</IconButton>
									</InputAdornment>
								}
								label="Password"
							/>
						</FormControl>
						<Button
							type="submit"
							fullWidth
							variant="contained"
							sx={{
								mt: 3,
								mb: 2,
								py: 1.8,
								fontSize: "1.1rem",
								fontWeight: 600,
								background: gradients.normal,
								boxShadow: "0 4px 15px 0 rgba(116, 75, 162, 0.4)",
								transition: "all 0.3s ease",
								"&:hover": {
									background: gradients.reversed,
									boxShadow: "0 6px 20px 0 rgba(116, 75, 162, 0.6)",
									transform: "translateY(-2px)",
								},
								"&:active": {
									transform: "translateY(0)",
								},
							}}
							disabled={loading || !flowId}
						>
							{loading ? <CircularProgress size={24} sx={{ color: "white" }} /> : "Sign In"}
						</Button>
					</Box>
				</Paper>
			</Container>
		</Box>
	);
}
