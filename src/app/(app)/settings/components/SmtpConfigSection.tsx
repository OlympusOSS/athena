"use client";

import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle, Icon, Input, Label } from "@olympusoss/canvas";
import { useCallback, useEffect, useRef, useState } from "react";

interface SmtpSettings {
	connectionUri: string;
	fromEmail: string;
	apiKey: string;
}

export function SmtpConfigSection() {
	const [settings, setSettings] = useState<SmtpSettings>({ connectionUri: "", fromEmail: "", apiKey: "" });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const uriRef = useRef("");
	const fromRef = useRef("");
	const apiKeyRef = useRef("");

	const saveSetting = useCallback(async (key: string, value: string, encrypted = false) => {
		if (!value.trim()) return;
		setError(null);
		try {
			const res = await fetch("/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key, value, encrypted, category: "smtp" }),
			});
			if (!res.ok) throw new Error(`Failed to save ${key}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		}
	}, []);

	const fetchSettings = useCallback(async () => {
		try {
			setLoading(true);
			const res = await fetch("/api/settings?category=smtp");
			if (!res.ok) throw new Error("Failed to fetch");
			const data = await res.json();
			const map: Record<string, string> = {};
			for (const s of data.settings || []) map[s.key] = s.value;
			setSettings({
				connectionUri: map["smtp.connection_uri"] || "",
				fromEmail: map["smtp.from_email"] || "",
				apiKey: map["smtp.api_key"] || "",
			});
			uriRef.current = map["smtp.connection_uri"] || "";
			fromRef.current = map["smtp.from_email"] || "";
			apiKeyRef.current = map["smtp.api_key"] || "";
		} catch {
			setError("Failed to load SMTP settings");
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
					Loading SMTP settings...
				</CardContent>
			</Card>
		);
	}

	return (
		<>
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Icon name="mail" className="h-4 w-4 text-muted-foreground" />
					<CardTitle className="text-base">SMTP / Resend</CardTitle>
					<span className="text-xs text-muted-foreground">&mdash; Email delivery for verification and password reset</span>
				</div>
			</CardHeader>
			<CardContent className="pt-0 space-y-4">
				{error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

				<div className="space-y-1.5">
					<Label htmlFor="smtp-uri" className="text-xs">SMTP Connection URI</Label>
					<div className="relative">
						<Icon name="link" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							id="smtp-uri"
							type="password"
							placeholder="smtps://resend:re_xxx@smtp.resend.com:465/"
							value={settings.connectionUri}
							onChange={(e) => setSettings((s) => ({ ...s, connectionUri: e.target.value }))}
							onBlur={() => {
								if (settings.connectionUri !== uriRef.current) {
									uriRef.current = settings.connectionUri;
									saveSetting("smtp.connection_uri", settings.connectionUri, true);
								}
							}}
							className="pl-8 text-sm font-mono"
						/>
					</div>
					<p className="text-xs text-muted-foreground">Full SMTP connection string including credentials</p>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="smtp-from" className="text-xs">From Email</Label>
					<div className="relative">
						<Icon name="mail" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							id="smtp-from"
							placeholder="noreply@example.com"
							value={settings.fromEmail}
							onChange={(e) => setSettings((s) => ({ ...s, fromEmail: e.target.value }))}
							onBlur={() => {
								if (settings.fromEmail !== fromRef.current) {
									fromRef.current = settings.fromEmail;
									saveSetting("smtp.from_email", settings.fromEmail);
								}
							}}
							className="pl-8 text-sm"
						/>
					</div>
					<p className="text-xs text-muted-foreground">Sender address for transactional emails</p>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="smtp-apikey" className="text-xs">Resend API Key</Label>
					<div className="relative">
						<Icon name="key" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							id="smtp-apikey"
							type="password"
							placeholder="re_xxxxxxxxxxxx"
							value={settings.apiKey}
							onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
							onBlur={() => {
								if (settings.apiKey !== apiKeyRef.current) {
									apiKeyRef.current = settings.apiKey;
									saveSetting("smtp.api_key", settings.apiKey, true);
								}
							}}
							className="pl-8 text-sm font-mono"
						/>
					</div>
					<p className="text-xs text-muted-foreground">Used for domain verification and email analytics</p>
				</div>

				<Alert className="py-2">
					<AlertDescription className="text-xs">Connection URI and API key are encrypted before storage (AES-256-GCM).</AlertDescription>
				</Alert>
			</CardContent>
		</Card>
		<p className="text-xs text-yellow-400 mt-2">Changes may take up to 60 seconds to propagate.</p>
		</>
	);
}
