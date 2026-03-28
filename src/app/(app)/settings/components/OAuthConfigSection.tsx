"use client";

import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle, Icon, Input, Label } from "@olympusoss/canvas";
import { useCallback, useEffect, useRef, useState } from "react";

interface OAuthSettings {
	clientId: string;
	clientSecret: string;
}

export function OAuthConfigSection() {
	const [settings, setSettings] = useState<OAuthSettings>({ clientId: "", clientSecret: "" });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const clientIdRef = useRef("");
	const clientSecretRef = useRef("");

	const saveSetting = useCallback(async (key: string, value: string, encrypted = false) => {
		setError(null);
		try {
			const res = await fetch("/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key, value, encrypted, category: "oauth" }),
			});
			if (!res.ok) throw new Error(`Failed to save ${key}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		}
	}, []);

	const fetchSettings = useCallback(async () => {
		try {
			setLoading(true);
			const res = await fetch("/api/settings?category=oauth");
			if (!res.ok) throw new Error("Failed to fetch");
			const data = await res.json();
			const map: Record<string, string> = {};
			for (const s of data.settings || []) map[s.key] = s.value;
			setSettings({
				clientId: map["oauth.client_id"] || "",
				clientSecret: map["oauth.client_secret"] || "",
			});
			clientIdRef.current = map["oauth.client_id"] || "";
			clientSecretRef.current = map["oauth.client_secret"] || "";
		} catch {
			setError("Failed to load OAuth settings");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchSettings();
	}, [fetchSettings]);

	if (loading) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
					<Icon name="loading" className="mr-2 h-4 w-4 animate-spin" />
					Loading OAuth settings...
				</CardContent>
			</Card>
		);
	}

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Icon name="key" className="h-4 w-4 text-muted-foreground" />
						<CardTitle className="text-base">OAuth2 Client Credentials</CardTitle>
						<span className="text-xs text-muted-foreground">&mdash; Used by this admin instance to authenticate with the OAuth2 service</span>
					</div>
				</CardHeader>
				<CardContent className="pt-0 space-y-4">
					{error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

					<div className="space-y-1.5">
						<Label htmlFor="oauth-client-id" className="text-xs">
							Client ID
						</Label>
						<div className="relative">
							<Icon name="user" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
							<Input
								id="oauth-client-id"
								placeholder="athena-iam-client"
								value={settings.clientId}
								onChange={(e) => setSettings((s) => ({ ...s, clientId: e.target.value }))}
								onBlur={() => {
									if (settings.clientId !== clientIdRef.current) {
										clientIdRef.current = settings.clientId;
										saveSetting("oauth.client_id", settings.clientId);
									}
								}}
								className="pl-8 text-sm font-mono"
							/>
						</div>
						<p className="text-xs text-muted-foreground">The OAuth2 client ID registered in the OAuth2 service for this admin panel</p>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="oauth-client-secret" className="text-xs">
							Client Secret
						</Label>
						<div className="relative">
							<Icon name="lock" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
							<Input
								id="oauth-client-secret"
								type="password"
								placeholder="Enter client secret..."
								value={settings.clientSecret}
								onChange={(e) => setSettings((s) => ({ ...s, clientSecret: e.target.value }))}
								onBlur={() => {
									if (settings.clientSecret !== clientSecretRef.current) {
										clientSecretRef.current = settings.clientSecret;
										saveSetting("oauth.client_secret", settings.clientSecret, true);
									}
								}}
								className="pl-8 text-sm font-mono"
							/>
						</div>
						<p className="text-xs text-muted-foreground">Server-side secret used for the token exchange (authorization code flow)</p>
					</div>

					<Alert className="py-2">
						<AlertDescription className="text-xs">
							Client secret is encrypted before storage (AES-256-GCM). Env vars are used as fallback when vault values are not set.
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
			<p className="text-xs text-yellow-400 mt-2">Changes may take up to 60 seconds to propagate.</p>
		</>
	);
}
