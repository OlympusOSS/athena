"use client";

import type { IconName } from "@olympusoss/canvas";
import {
	Badge,
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
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Toast,
	Toaster,
	useToast,
} from "@olympusoss/canvas";
import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ProtectedPage } from "@/components/layout";
import { useAllOAuth2Clients } from "@/features/oauth2-clients/hooks/useOAuth2Clients";
import {
	useDefaultClientId,
	useHydraEnabled,
	useHydraEndpoints,
	useIsValidUrl,
	useKratosEndpoints,
	useSetDefaultClientId,
	useSetHydraEnabled,
	useSetHydraEndpoints,
	useSetKratosEndpoints,
} from "@/features/settings/hooks/useSettings";
import {
	CaptchaConfigSection,
	GeoConfigSection,
	OAuthConfigSection,
	ServiceConfigSection,
	SettingsVaultSection,
	SmtpConfigSection,
} from "../components";
import { useServiceSettingsForm } from "../hooks";

const VALID_TABS = ["general", "vault", "kratos", "hydra", "geo"] as const;
type SettingsTab = (typeof VALID_TABS)[number];

/* ── Inline helper: a single row in a settings card ── */
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
	const router = useRouter();
	const params = useParams<{ tab?: string[] }>();
	const tabSlug = params.tab?.[0];
	const activeTab: SettingsTab = VALID_TABS.includes(tabSlug as SettingsTab) ? (tabSlug as SettingsTab) : "general";

	const { toast, show: showSuccessToast, dismiss } = useToast();

	// Settings store hooks
	const hydraEnabled = useHydraEnabled();
	const setHydraEnabled = useSetHydraEnabled();
	const kratosEndpoints = useKratosEndpoints();
	const setKratosEndpoints = useSetKratosEndpoints();
	const hydraEndpoints = useHydraEndpoints();
	const setHydraEndpoints = useSetHydraEndpoints();
	const defaultClientId = useDefaultClientId();
	const setDefaultClientId = useSetDefaultClientId();
	const isValidUrl = useIsValidUrl();

	// OAuth2 clients for default client dropdown
	const { data: allClientsData } = useAllOAuth2Clients({ enabled: hydraEnabled });

	// Success callback for all save operations
	const showSuccess = () => showSuccessToast("Settings saved successfully!", "success");

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
	const handleHydraEnabledChange = (enabled: boolean) => {
		setHydraEnabled(enabled);
		showSuccess();
	};

	const handleDefaultClientChange = (value: string) => {
		setDefaultClientId(value === "none" ? "" : value);
		showSuccess();
	};

	return (
		<ProtectedPage>
			<Tabs value={activeTab} onValueChange={(value) => router.push(`/settings/${value}`, { scroll: false })}>
				<TabsList>
					<TabsTrigger value="general">
						<Icon name="settings" className="h-3.5 w-3.5" />
						General
					</TabsTrigger>
					<TabsTrigger value="vault">
						<Icon name="lock" className="h-3.5 w-3.5" />
						Vault
					</TabsTrigger>
					<TabsTrigger value="kratos">
						<Icon name="shield" className="h-3.5 w-3.5" />
						Kratos
					</TabsTrigger>
					<TabsTrigger value="hydra">
						<Icon name="key" className="h-3.5 w-3.5" />
						Hydra
					</TabsTrigger>
					<TabsTrigger value="geo">
						<Icon name="globe" className="h-3.5 w-3.5" />
						Geolocation
					</TabsTrigger>
				</TabsList>

				{/* ── General ── */}
				<TabsContent value="general">
					<Card>
						<CardHeader>
							<CardTitle className="text-base">General</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<p className="py-4 text-sm text-muted-foreground">Application-wide settings that don't belong to a specific service.</p>
						</CardContent>
					</Card>
				</TabsContent>

				{/* ── Vault ── */}
				<TabsContent value="vault">
					<SettingsVaultSection />
				</TabsContent>

				{/* ── Kratos (endpoints + SMTP + CAPTCHA) ── */}
				<TabsContent value="kratos">
					<div className="space-y-6">
						<Card>
							<CardContent className="pt-6">
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
								/>
							</CardContent>
						</Card>

						<SmtpConfigSection />
						<CaptchaConfigSection />
					</div>
				</TabsContent>

				{/* ── Hydra (enabled toggle + endpoints + default client) ── */}
				<TabsContent value="hydra">
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Hydra Integration</CardTitle>
							</CardHeader>
							<CardContent className="pt-0">
								<SettingRow
									icon="grid"
									label="Enable Hydra"
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

						{hydraEnabled && (
							<>
							<Card>
								<CardContent className="pt-6">
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
								</CardContent>
							</Card>
							<OAuthConfigSection />
							</>
						)}
					</div>
				</TabsContent>

				{/* ── Geolocation ── */}
				<TabsContent value="geo">
					<GeoConfigSection />
				</TabsContent>
			</Tabs>

			<Toaster>
				<Toast {...toast} onClose={dismiss} />
			</Toaster>
		</ProtectedPage>
	);
}
