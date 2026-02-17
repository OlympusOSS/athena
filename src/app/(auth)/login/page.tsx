"use client";

import { AdminPanelSettings, RemoveRedEye, Visibility, VisibilityOff } from "@mui/icons-material";
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	Chip,
	CircularProgress,
	Container,
	Divider,
	FormControl,
	Grid,
	IconButton,
	InputAdornment,
	InputLabel,
	OutlinedInput,
	Paper,
	TextField,
	Typography,
} from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { LoginFlow } from "@ory/kratos-client";
import { getIamKratosFrontendApi } from "@/services/iam-kratos";
import { DEMO_ACCOUNTS, UserRole } from "@/features/auth";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { alpha, gradientColors, gradients } from "@/theme";

export default function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [flow, setFlow] = useState<LoginFlow | null>(null);
	const [flowLoading, setFlowLoading] = useState(true);

	const { login } = useAuthStore();
	const router = useRouter();
	const searchParams = useSearchParams();
	const returnTo = searchParams.get("return_to") || "/dashboard";

	// Create or fetch login flow
	const initializeFlow = useCallback(async () => {
		try {
			setFlowLoading(true);
			const api = getIamKratosFrontendApi();

			// Check if there's a flow ID in the URL (Kratos redirect)
			const flowId = searchParams.get("flow");
			if (flowId) {
				const { data } = await api.getLoginFlow({ id: flowId });
				setFlow(data);
			} else {
				const { data } = await api.createBrowserLoginFlow({
					returnTo,
				});
				setFlow(data);
			}
		} catch (err) {
			console.error("Failed to initialize login flow:", err);
			setError("Failed to initialize login. Please refresh the page.");
		} finally {
			setFlowLoading(false);
		}
	}, [searchParams, returnTo]);

	useEffect(() => {
		initializeFlow();
	}, [initializeFlow]);

	// Extract CSRF token from flow UI nodes
	const getCsrfToken = (): string => {
		if (!flow?.ui?.nodes) return "";
		const csrfNode = flow.ui.nodes.find(
			(node) => node.attributes && "name" in node.attributes && node.attributes.name === "csrf_token" && "type" in node.attributes && node.attributes.type === "hidden",
		);
		return csrfNode?.attributes && "value" in csrfNode.attributes ? (csrfNode.attributes.value as string) : "";
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!email || !password) {
			setError("Please enter both email and password");
			return;
		}

		if (!flow) {
			setError("Login flow not initialized. Please refresh the page.");
			return;
		}

		setLoading(true);
		setError("");

		try {
			const csrfToken = getCsrfToken();
			const success = await login(flow.id, csrfToken, email, password);

			if (success) {
				router.push(returnTo);
			} else {
				// Error is set in the store; get it
				const storeError = useAuthStore.getState().error;
				setError(storeError || "Invalid email or password");
				// Re-initialize flow (Kratos may invalidate used flows)
				await initializeFlow();
			}
		} catch (err) {
			setError("An error occurred during login");
			console.error(err);
			await initializeFlow();
		} finally {
			setLoading(false);
		}
	};

	const handleClickShowPassword = () => {
		setShowPassword(!showPassword);
	};

	const setDemoCredentials = (demoEmail: string, demoPassword: string) => {
		setEmail(demoEmail);
		setPassword(demoPassword);
	};

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
						Athena
					</Typography>
					<Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontWeight: 500 }}>
						Sign in to your account
					</Typography>

					{error && (
						<Alert severity="error" sx={{ width: "100%", mb: 3 }}>
							{error}
						</Alert>
					)}

					{flowLoading ? (
						<Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
							<CircularProgress />
						</Box>
					) : (
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
								disabled={loading || !flow}
							>
								{loading ? <CircularProgress size={24} sx={{ color: "white" }} /> : "Sign In"}
							</Button>
						</Box>
					)}

					<Divider sx={{ width: "100%", my: 4 }}>
						<Typography variant="body1" sx={{ fontWeight: 600, color: "text.secondary" }}>
							Demo Accounts
						</Typography>
					</Divider>

					<Grid container spacing={2}>
						{DEMO_ACCOUNTS.map((account) => (
							<Grid size={{ xs: 12, sm: 6 }} key={account.email}>
								<Card
									elevation={0}
									sx={{
										cursor: "pointer",
										background:
											account.role === UserRole.ADMIN
												? gradients.subtle
												: "linear-gradient(135deg, rgba(240, 147, 251, 0.1) 0%, rgba(79, 172, 254, 0.1) 100%)",
										border: "2px solid",
										borderColor: account.role === UserRole.ADMIN ? alpha.primary[30] : "rgba(240, 147, 251, 0.3)",
										borderRadius: 3,
										transition: "all 0.3s ease",
										"&:hover": {
											borderColor: account.role === UserRole.ADMIN ? gradientColors.primary : "#f093fb",
											transform: "translateY(-4px)",
											boxShadow:
												account.role === UserRole.ADMIN ? `0 8px 24px ${alpha.primary[30]}` : "0 8px 24px rgba(240, 147, 251, 0.3)",
										},
									}}
									onClick={() => setDemoCredentials(account.email, account.password)}
								>
									<CardContent sx={{ p: 2.5 }}>
										<Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
											{account.role === UserRole.ADMIN ? (
												<AdminPanelSettings
													sx={{
														mr: 1.5,
														fontSize: 28,
														color: gradientColors.primary,
													}}
												/>
											) : (
												<RemoveRedEye
													sx={{
														mr: 1.5,
														fontSize: 28,
														color: "#f093fb",
													}}
												/>
											)}
											<Typography variant="h6" sx={{ fontWeight: 700 }}>
												{account.displayName}
											</Typography>
										</Box>
										<Chip
											label={account.role}
											size="small"
											sx={{
												mb: 1.5,
												fontWeight: 600,
												background:
													account.role === UserRole.ADMIN ? gradients.normal : "linear-gradient(135deg, #f093fb 0%, #4facfe 100%)",
												color: "white",
											}}
										/>
										<Typography variant="body2" sx={{ mb: 0.5, color: "text.primary" }}>
											Email: <strong>{account.email}</strong>
										</Typography>
										<Typography variant="body2" sx={{ color: "text.primary" }}>
											Password: <strong>{account.password}</strong>
										</Typography>
									</CardContent>
								</Card>
							</Grid>
						))}
					</Grid>
				</Paper>
			</Container>
		</Box>
	);
}
