"use client";

import { Alert, AlertDescription, Badge, Button, Icon, Input, Label } from "@olympusoss/canvas";
import { useForm } from "react-hook-form";
import { useCreateSocialConnection } from "@/hooks/useSocialConnections";
import type { ReloadStatus } from "@/lib/social-connections/reload-client";
import type { SocialConnectionAdminView } from "@/lib/social-connections/serializers";

/**
 * SocialConnectionForm (athena#49 T14 + T15)
 *
 * Add/Edit form for social connection configuration. Uses React Hook Form.
 *
 * Security:
 * - Google OAuth2 endpoints are pre-filled as read-only (V10 mitigation / prevents misconfiguration)
 * - Required Kratos callback URI is displayed in a read-only callout (V10 mitigation)
 * - client_secret field shows placeholder "••••••••" when editing (never shows actual value)
 * - Leaving client_secret blank on edit = "no change" (partial save support)
 */

// Google OIDC provider template — these endpoints are not editable by the admin.
// Pre-filling prevents misconfiguration (V10 mitigation from Security Review).
const GOOGLE_TEMPLATE = {
	authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
	token_endpoint: "https://oauth2.googleapis.com/token",
	jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
	default_scopes: ["openid", "email", "profile"],
};

// Provider options: Google is active in V1. Others are "coming soon" and disabled.
const PROVIDER_OPTIONS = [
	{ value: "google", label: "Google", available: true },
	{ value: "github", label: "GitHub", available: false },
	{ value: "microsoft", label: "Microsoft", available: false },
	{ value: "linkedin", label: "LinkedIn", available: false },
] as const;

interface SocialConnectionFormValues {
	provider: string;
	client_id: string;
	client_secret: string;
	enabled: boolean;
}

interface SocialConnectionFormProps {
	mode: "create" | "edit";
	existingConnection: SocialConnectionAdminView | null;
	onSuccess: (reloadStatus: ReloadStatus, secretChanged: boolean) => void;
	onCancel: () => void;
}

export function SocialConnectionForm({ mode, existingConnection, onSuccess, onCancel }: SocialConnectionFormProps) {
	const createMutation = useCreateSocialConnection();

	const {
		register,
		handleSubmit,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<SocialConnectionFormValues>({
		defaultValues: {
			provider: existingConnection?.provider ?? "google",
			client_id: existingConnection?.client_id ?? "",
			client_secret: "", // Always blank — shows placeholder for existing connections
			enabled: existingConnection?.enabled ?? true,
		},
	});

	const selectedProvider = watch("provider");

	// Base URL for Kratos callback URI — uses NEXT_PUBLIC_KRATOS_PUBLIC_URL or falls back to relative
	const kratosBaseUrl = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.host}` : "<your-domain>";
	const callbackUri = `${kratosBaseUrl}/self-service/methods/oidc/callback/${selectedProvider}`;

	const onSubmit = async (values: SocialConnectionFormValues) => {
		const secretChanged = values.client_secret.trim().length > 0;

		const payload = {
			provider: values.provider,
			client_id: values.client_id.trim(),
			// Only include client_secret if it was actually entered
			...(secretChanged ? { client_secret: values.client_secret } : {}),
			scopes: GOOGLE_TEMPLATE.default_scopes,
			enabled: values.enabled,
		};

		try {
			const result = await createMutation.mutateAsync(payload);
			onSuccess(result.reloadStatus, result.secretChanged);
		} catch {
			// Error is stored in createMutation.error and displayed in the UI via
			// the createMutation.isError branch below. Do not re-throw — this keeps
			// the dialog open so the admin can correct the input and retry.
		}
	};

	const isGoogleSelected = selectedProvider === "google";

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			{/* Provider Selection */}
			<div className="space-y-2">
				<Label htmlFor="provider">Provider</Label>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{PROVIDER_OPTIONS.map((option) => (
						<label
							key={option.value}
							className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
								!option.available ? "cursor-not-allowed opacity-50" : ""
							} ${selectedProvider === option.value && option.available ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
						>
							<input
								type="radio"
								value={option.value}
								disabled={!option.available}
								className="sr-only"
								{...register("provider", { required: true })}
							/>
							<Icon name="AppWindow" className="h-6 w-6" />
							<span className="font-medium">{option.label}</span>
							{!option.available && (
								<Badge variant="secondary" className="text-xs">
									Coming soon
								</Badge>
							)}
						</label>
					))}
				</div>
			</div>

			{/* Kratos Callback URI — read-only callout (V10 mitigation) */}
			{isGoogleSelected && (
				<Alert>
					<Icon name="Info" />
					<AlertDescription className="space-y-2">
						<p className="text-sm font-medium">Before saving, register this callback URI in your Google Cloud Console:</p>
						<div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
							<code className="text-xs break-all">{callbackUri}</code>
						</div>
						<p className="text-xs text-muted-foreground">
							Add this URI to the "Authorized redirect URIs" in your Google OAuth2 client configuration. Saving without registering it will cause{" "}
							<code className="text-xs">redirect_uri_mismatch</code> errors during login.
						</p>
					</AlertDescription>
				</Alert>
			)}

			{/* Client ID */}
			<div className="space-y-2">
				<Label htmlFor="client_id">Client ID</Label>
				<Input
					id="client_id"
					placeholder="123456789-abc.apps.googleusercontent.com"
					aria-invalid={!!errors.client_id}
					{...register("client_id", {
						required: "Client ID is required",
						maxLength: { value: 512, message: "Client ID must not exceed 512 characters" },
						pattern: {
							value: /^[\w.\-@]+$/,
							message: "Client ID contains invalid characters",
						},
					})}
				/>
				{errors.client_id && <p className="text-xs text-destructive">{errors.client_id.message}</p>}
			</div>

			{/* Client Secret */}
			<div className="space-y-2">
				<Label htmlFor="client_secret">
					Client Secret
					{mode === "edit" && <span className="ml-1 text-xs font-normal text-muted-foreground">(leave blank to keep existing secret)</span>}
				</Label>
				<Input
					id="client_secret"
					type="password"
					placeholder={mode === "edit" ? "••••••••" : "Enter client secret"}
					aria-invalid={!!errors.client_secret}
					{...register("client_secret", {
						...(mode === "create"
							? {
									required: "Client secret is required",
									maxLength: { value: 4096, message: "Client secret must not exceed 4096 characters" },
								}
							: {
									maxLength: { value: 4096, message: "Client secret must not exceed 4096 characters" },
								}),
					})}
				/>
				{errors.client_secret && <p className="text-xs text-destructive">{errors.client_secret.message}</p>}
				{mode === "edit" && (
					<p className="text-xs text-muted-foreground">Saving a new client secret requires a Kratos service restart to take effect.</p>
				)}
			</div>

			{/* Google read-only endpoints (pre-configured template) */}
			{isGoogleSelected && (
				<div className="space-y-4 rounded-lg border border-border bg-muted/50 p-4">
					<div className="flex items-center gap-2">
						<Icon name="Lock" className="h-4 w-4 text-muted-foreground" />
						<span className="text-sm font-medium text-muted-foreground">Google OAuth2 Endpoints (pre-configured, read-only)</span>
					</div>
					<div className="space-y-3">
						<div className="space-y-1">
							<Label className="text-xs text-muted-foreground">Authorization Endpoint</Label>
							<Input value={GOOGLE_TEMPLATE.authorization_endpoint} readOnly disabled className="text-xs" />
						</div>
						<div className="space-y-1">
							<Label className="text-xs text-muted-foreground">Token Endpoint</Label>
							<Input value={GOOGLE_TEMPLATE.token_endpoint} readOnly disabled className="text-xs" />
						</div>
						<div className="space-y-1">
							<Label className="text-xs text-muted-foreground">JWKS URI</Label>
							<Input value={GOOGLE_TEMPLATE.jwks_uri} readOnly disabled className="text-xs" />
						</div>
					</div>
					<p className="text-xs text-muted-foreground">
						These endpoints are pre-configured for Google and cannot be edited to prevent misconfiguration.
					</p>
				</div>
			)}

			{/* Scopes (read-only, pre-populated) */}
			<div className="space-y-2">
				<Label>Scopes</Label>
				<div className="flex flex-wrap gap-2">
					{GOOGLE_TEMPLATE.default_scopes.map((scope) => (
						<Badge key={scope} variant="secondary">
							{scope}
						</Badge>
					))}
				</div>
				<p className="text-xs text-muted-foreground">Standard OAuth2 scopes for Google. These are pre-configured and cannot be changed in V1.</p>
			</div>

			{/* API error */}
			{createMutation.isError && (
				<Alert variant="destructive">
					<Icon name="TriangleAlert" />
					<AlertDescription>{createMutation.error?.message ?? "Failed to save connection. Please try again."}</AlertDescription>
				</Alert>
			)}

			{/* Actions */}
			<div className="flex justify-end gap-3">
				<Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting || createMutation.isPending}>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting || createMutation.isPending}>
					{createMutation.isPending ? (
						<>
							<Icon name="LoaderCircle" className="h-4 w-4 animate-spin" />
							Saving...
						</>
					) : mode === "create" ? (
						"Add Connection"
					) : (
						"Save Changes"
					)}
				</Button>
			</div>
		</form>
	);
}
