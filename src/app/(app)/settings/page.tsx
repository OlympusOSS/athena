"use client";

import type { IconName } from "@olympusoss/canvas";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	cn,
	Icon,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
} from "@olympusoss/canvas";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { PageHeader, ProtectedPage } from "@/components/layout";
import { useAllOAuth2Clients } from "@/features/oauth2-clients/hooks/useOAuth2Clients";
import {
	useDefaultClientId,
	useHydraEnabled,
	useHydraEndpoints,
	useIsOryNetwork,
	useIsValidUrl,
	useKratosEndpoints,
	useResetSettings,
	useSetDefaultClientId,
	useSetHydraEnabled,
	useSetHydraEndpoints,
	useSetIsOryNetwork,
	useSetKratosEndpoints,
} from "@/features/settings/hooks/useSettings";
import { useTheme } from "@/providers/ThemeProvider";
import { ServiceConfigSection } from "./components";
import { useServiceSettingsForm } from "./hooks";

/* ── Inline helper: a single row in the General settings card ── */
function SettingRow({
	icon,
	label,
	description,
	badge,
	children,
	last = false,
}: {
	icon: IconName;
	label: string;
	description: string;
	badge?: ReactNode;
	children: ReactNode;
	last?: boolean;
}) {
	return (
		<div className={cn("flex items-center justify-between py-4", !last && "border-b border-border")}>
			<div className="space-y-0.5 pr-6">
				<div className="flex items-center gap-2">
					<Icon name={icon} className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium text-foreground">{label}</span>
					{badge}
				</div>
				<p className="text-[13px] text-muted-foreground">{description}</p>
			</div>
			{children}
		</div>
	);
}

export default function SettingsPage() {
	const [showSuccessMessage, setShowSuccessMessage] = useState(false);
	const { theme: currentTheme, toggleTheme } = useTheme();

	// Settings store hooks
	const isOryNetwork = useIsOryNetwork();
	const setIsOryNetwork = useSetIsOryNetwork();
	const hydraEnabled = useHydraEnabled();
	const setHydraEnabled = useSetHydraEnabled();
	const kratosEndpoints = useKratosEndpoints();
	const setKratosEndpoints = useSetKratosEndpoints();
	const hydraEndpoints = useHydraEndpoints();
	const setHydraEndpoints = useSetHydraEndpoints();
	const defaultClientId = useDefaultClientId();
	const setDefaultClientId = useSetDefaultClientId();
	const resetSettings = useResetSettings();
	const isValidUrl = useIsValidUrl();

	// OAuth2 clients for default client dropdown
	const { data: allClientsData } = useAllOAuth2Clients({ enabled: hydraEnabled });

	// Success callback for all save operations
	const showSuccess = () => setShowSuccessMessage(true);

	// Form hooks for Kratos and Hydra
	const kratosForm = useServiceSettingsForm({
		endpoints: kratosEndpoints,
		setEndpoints: setKratosEndpoints,
		onSuccess: showSuccess,
	});

	const hydraForm = useServiceSettingsForm({
		endpoints: hydraEndpoints,
		setEndpoints: setHydraEndpoints,
		onSuccess: showSuccess,
	});

	// URL validation
	const validateUrl = (value: string) => {
		if (!value.trim()) return "URL is required";
		if (!isValidUrl(value.trim())) return "Please enter a valid URL";
		return true;
	};

	// Event handlers
	const handleThemeChange = () => {
		toggleTheme();
		showSuccess();
	};

	const handleOryNetworkChange = (enabled: boolean) => {
		setIsOryNetwork(enabled);
		showSuccess();
	};

	const handleHydraEnabledChange = (enabled: boolean) => {
		setHydraEnabled(enabled);
		showSuccess();
	};

	const handleDefaultClientChange = (value: string) => {
		setDefaultClientId(value === "none" ? "" : value);
		showSuccess();
	};

	const [isResetting, setIsResetting] = useState(false);
	const handleResetAll = async () => {
		setIsResetting(true);
		try {
			await resetSettings();
			showSuccess();
		} finally {
			setIsResetting(false);
		}
	};

	// Auto-hide success message
	useEffect(() => {
		if (showSuccessMessage) {
			const timer = setTimeout(() => setShowSuccessMessage(false), 3000);
			return () => clearTimeout(timer);
		}
	}, [showSuccessMessage]);

	return (
		<ProtectedPage>
			<PageHeader title="Settings" subtitle="Configure application preferences and API endpoints" icon={<Icon name="settings" />} />

			<div className="space-y-6">
				{/* ── General Settings ── */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">General</CardTitle>
					</CardHeader>
					<CardContent className="pt-0">
						<SettingRow icon="sun" label="Dark mode" description="Toggle between light and dark theme">
							<Switch checked={currentTheme === "dark"} onCheckedChange={handleThemeChange} />
						</SettingRow>

						<SettingRow
							icon="cloud"
							label="Ory Network"
							description={isOryNetwork ? "Connected to Ory Network. Health checks are skipped." : "Self-hosted mode. Health checks are enabled."}
							badge={
								<Badge variant={isOryNetwork ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
									{isOryNetwork ? "Cloud" : "Self-Hosted"}
								</Badge>
							}
						>
							<Switch checked={isOryNetwork} onCheckedChange={handleOryNetworkChange} />
						</SettingRow>

						<SettingRow
							icon="grid"
							label="Hydra integration"
							description={
								hydraEnabled ? "OAuth2 client management and analytics are available." : "Enable to manage OAuth2 clients and view analytics."
							}
							badge={
								<Badge variant={hydraEnabled ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
									{hydraEnabled ? "Enabled" : "Disabled"}
								</Badge>
							}
							last={!hydraEnabled}
						>
							<Switch checked={hydraEnabled} onCheckedChange={handleHydraEnabledChange} />
						</SettingRow>

						{hydraEnabled && (
							<SettingRow icon="key" label="Default client" description="OAuth2 client used when users navigate directly to the login page." last>
								<Select value={defaultClientId || "none"} onValueChange={handleDefaultClientChange}>
									<SelectTrigger className="w-[220px]">
										<SelectValue placeholder="Select a client…" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">None</SelectItem>
										{allClientsData?.clients?.map((client) => (
											<SelectItem key={client.client_id} value={client.client_id!}>
												{client.client_name || client.client_id}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</SettingRow>
						)}
					</CardContent>
				</Card>

				{/* ── API Endpoints ── */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">API Endpoints</CardTitle>
					</CardHeader>
					<CardContent className="pt-0">
						<ServiceConfigSection
							serviceName="Kratos"
							form={kratosForm.form}
							currentEndpoints={kratosEndpoints}
							publicUrlPlaceholder="http://localhost:3100"
							adminUrlPlaceholder="http://localhost:3101"
							publicUrlHelperText="Used for public API calls"
							adminUrlHelperText="Used for admin API calls"
							onSave={kratosForm.handleSave}
							validateUrl={validateUrl}
							isEditingApiKey={kratosForm.isEditingApiKey}
							onApiKeyEditStart={kratosForm.startEditingApiKey}
							showDivider={hydraEnabled}
						/>

						{hydraEnabled && (
							<ServiceConfigSection
								serviceName="Hydra"
								form={hydraForm.form}
								currentEndpoints={hydraEndpoints}
								publicUrlPlaceholder="http://localhost:3102"
								adminUrlPlaceholder="http://localhost:3103"
								publicUrlHelperText="Used for OAuth2/OIDC public endpoints"
								adminUrlHelperText="Used for OAuth2 client and flow management"
								onSave={hydraForm.handleSave}
								validateUrl={validateUrl}
								isEditingApiKey={hydraForm.isEditingApiKey}
								onApiKeyEditStart={hydraForm.startEditingApiKey}
							/>
						)}
					</CardContent>
				</Card>

				{/* ── Danger Zone ── */}
				<div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
					<div className="flex items-center gap-3">
						<Icon name="warning" className="h-4 w-4 text-destructive" />
						<div>
							<p className="text-sm font-medium text-destructive">Reset all settings</p>
							<p className="text-xs text-muted-foreground">Clears all endpoint configurations and API keys. Cannot be undone.</p>
						</div>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={handleResetAll}
						disabled={isResetting}
						className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
					>
						<Icon name="reset" className="mr-1 h-3.5 w-3.5" />
						{isResetting ? "Resetting..." : "Reset"}
					</Button>
				</div>
			</div>

			{/* Success toast */}
			<div
				className={cn(
					"fixed bottom-4 right-4 z-50 transition-all duration-300",
					showSuccessMessage ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none",
				)}
			>
				<div className="flex items-center gap-3 rounded-lg border border-success bg-success/10 px-4 py-3 shadow-lg">
					<svg className="h-5 w-5 text-success" fill="currentColor" viewBox="0 0 20 20">
						<path
							fillRule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clipRule="evenodd"
						/>
					</svg>
					Settings saved successfully!
				</div>
			</div>
		</ProtectedPage>
	);
}
