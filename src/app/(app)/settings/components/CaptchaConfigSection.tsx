"use client";

import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle, Icon, Input, Label, Switch, cn } from "@olympusoss/canvas";
import { useCallback, useEffect, useRef, useState } from "react";

interface CaptchaSettings {
	enabled: boolean;
	siteKey: string;
	secretKey: string;
}

export function CaptchaConfigSection() {
	const [settings, setSettings] = useState<CaptchaSettings>({ enabled: false, siteKey: "", secretKey: "" });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const siteKeyRef = useRef("");
	const secretKeyRef = useRef("");

	const saveSetting = useCallback(async (key: string, value: string, encrypted = false) => {
		setError(null);
		try {
			const res = await fetch("/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key, value, encrypted, category: "captcha" }),
			});
			if (!res.ok) throw new Error(`Failed to save ${key}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		}
	}, []);

	const fetchSettings = useCallback(async () => {
		try {
			setLoading(true);
			const res = await fetch("/api/settings?category=captcha");
			if (!res.ok) throw new Error("Failed to fetch");
			const data = await res.json();
			const map: Record<string, string> = {};
			for (const s of data.settings || []) map[s.key] = s.value;
			setSettings({
				enabled: map["captcha.enabled"] === "true",
				siteKey: map["captcha.site_key"] || "",
				secretKey: map["captcha.secret_key"] || "",
			});
			siteKeyRef.current = map["captcha.site_key"] || "";
			secretKeyRef.current = map["captcha.secret_key"] || "";
		} catch {
			setError("Failed to load CAPTCHA settings");
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
					Loading CAPTCHA settings...
				</CardContent>
			</Card>
		);
	}

	return (
		<>
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Icon name="shield" className="h-4 w-4 text-muted-foreground" />
					<CardTitle className="text-base">Cloudflare Turnstile</CardTitle>
					<span className="text-xs text-muted-foreground">&mdash; Bot protection for login and registration</span>
				</div>
			</CardHeader>
			<CardContent className="pt-0 space-y-4">
				{error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

				<div className={cn("flex items-center justify-between rounded-md border border-border px-3 py-3")}>
					<div className="space-y-0.5">
						<Label className="text-xs font-medium">Enable CAPTCHA</Label>
						<p className="text-[11px] text-muted-foreground">Require Turnstile verification on login and registration forms</p>
					</div>
					<Switch checked={settings.enabled} onCheckedChange={(checked) => {
						setSettings((s) => ({ ...s, enabled: checked }));
						saveSetting("captcha.enabled", String(checked));
					}} />
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="captcha-site-key" className="text-xs">Site Key</Label>
					<div className="relative">
						<Icon name="globe" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							id="captcha-site-key"
							placeholder="0x4AAAAAAA..."
							value={settings.siteKey}
							onChange={(e) => setSettings((s) => ({ ...s, siteKey: e.target.value }))}
							onBlur={() => {
								if (settings.siteKey !== siteKeyRef.current) {
									siteKeyRef.current = settings.siteKey;
									saveSetting("captcha.site_key", settings.siteKey);
								}
							}}
							className="pl-8 text-sm font-mono"
						/>
					</div>
					<p className="text-xs text-muted-foreground">Public key embedded in the client-side widget</p>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="captcha-secret-key" className="text-xs">Secret Key</Label>
					<div className="relative">
						<Icon name="key" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							id="captcha-secret-key"
							type="password"
							placeholder="0x4AAAAAAA..."
							value={settings.secretKey}
							onChange={(e) => setSettings((s) => ({ ...s, secretKey: e.target.value }))}
							onBlur={() => {
								if (settings.secretKey !== secretKeyRef.current) {
									secretKeyRef.current = settings.secretKey;
									saveSetting("captcha.secret_key", settings.secretKey, true);
								}
							}}
							className="pl-8 text-sm font-mono"
						/>
					</div>
					<p className="text-xs text-muted-foreground">Server-side key for verifying CAPTCHA responses</p>
				</div>

				<Alert className="py-2">
					<AlertDescription className="text-xs">Secret key is encrypted before storage (AES-256-GCM).</AlertDescription>
				</Alert>
			</CardContent>
		</Card>
		<p className="text-xs text-yellow-400 mt-2">Changes may take up to 60 seconds to propagate.</p>
	</>
	);
}
