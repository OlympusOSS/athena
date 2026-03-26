"use client";

import { Alert, AlertDescription, Button, Card, CardContent, CardHeader, CardTitle, cn, Icon, Input, Label, Switch } from "@olympusoss/canvas";
import { useCallback, useEffect, useRef, useState } from "react";

interface GeoSettings {
	enabled: boolean;
	mandatory: boolean;
	endpoint: string;
}

export function GeoConfigSection() {
	const [settings, setSettings] = useState<GeoSettings>({ enabled: false, mandatory: false, endpoint: "" });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [savingEndpoint, setSavingEndpoint] = useState(false);
	const endpointRef = useRef(settings.endpoint);

	const saveSetting = useCallback(async (key: string, value: string) => {
		setError(null);
		try {
			const res = await fetch("/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key, value, encrypted: false, category: "geo" }),
			});
			if (!res.ok) throw new Error(`Failed to save ${key}`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		}
	}, []);

	const fetchSettings = useCallback(async () => {
		try {
			setLoading(true);
			const res = await fetch("/api/settings?category=geo");
			if (!res.ok) throw new Error("Failed to fetch");
			const data = await res.json();
			const map: Record<string, string> = {};
			for (const s of data.settings || []) map[s.key] = s.value;
			const ep = map["geo.endpoint"] || "http://ip-api.com/batch";
			setSettings({
				enabled: map["geo.enabled"] === "true",
				mandatory: map["geo.mandatory"] === "true",
				endpoint: ep,
			});
			endpointRef.current = ep;
		} catch {
			setError("Failed to load geolocation settings");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchSettings();
	}, [fetchSettings]);

	if (loading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2">
				<Card>
					<CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
						<Icon name="loading" className="mr-2 h-4 w-4 animate-spin" />
						Loading...
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
						<Icon name="loading" className="mr-2 h-4 w-4 animate-spin" />
						Loading...
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

			<div className="grid gap-4 sm:grid-cols-2">
				{/* Left card — Toggles */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Icon name="globe" className="h-4 w-4 text-muted-foreground" />
							<CardTitle className="text-base">Geolocation</CardTitle>
						</div>
					</CardHeader>
					<CardContent className="pt-0 space-y-4">
						<div className={cn("flex items-center justify-between rounded-md border border-border px-3 py-3")}>
							<div className="space-y-0.5">
								<Label className="text-xs font-medium">Enable geolocation</Label>
								<p className="text-[11px] text-muted-foreground">Resolve session IPs to geographic coordinates</p>
							</div>
							<Switch
								checked={settings.enabled}
								onCheckedChange={(checked) => {
									setSettings((s) => ({ ...s, enabled: checked, mandatory: checked ? s.mandatory : false }));
									saveSetting("geo.enabled", String(checked));
									if (!checked) saveSetting("geo.mandatory", "false");
								}}
							/>
						</div>

						{settings.enabled && (
							<div className={cn("flex items-center justify-between rounded-md border border-border px-3 py-3")}>
								<div className="space-y-0.5">
									<Label className="text-xs font-medium">Mandatory geolocation</Label>
									<p className="text-[11px] text-muted-foreground">Require browser location before sign-in</p>
								</div>
								<Switch
									checked={settings.mandatory}
									onCheckedChange={(checked) => {
										setSettings((s) => ({ ...s, mandatory: checked }));
										saveSetting("geo.mandatory", String(checked));
									}}
								/>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Right card — Endpoint */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Icon name="globe" className="h-4 w-4 text-muted-foreground" />
							<CardTitle className="text-base">API Endpoint</CardTitle>
						</div>
					</CardHeader>
					<CardContent className="pt-0 space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="geo-endpoint" className="text-xs">
								Batch Endpoint
							</Label>
							<div className="relative">
								<Icon name="globe" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
								<Input
									id="geo-endpoint"
									placeholder="http://ip-api.com/batch"
									value={settings.endpoint}
									onChange={(e) => setSettings((s) => ({ ...s, endpoint: e.target.value }))}
									className="pl-8 text-sm font-mono"
								/>
							</div>
							<p className="text-xs text-muted-foreground">Resolves IP addresses to locations (free tier: 45 req/min)</p>
						</div>

						<Alert className="py-2">
							<AlertDescription className="text-xs">
								IP-API free tier is rate-limited. For production, consider a paid plan or self-hosted alternative.
							</AlertDescription>
						</Alert>

						<div className="flex justify-end">
							<Button
								size="sm"
								disabled={settings.endpoint === endpointRef.current || savingEndpoint}
								onClick={async () => {
									setSavingEndpoint(true);
									await saveSetting("geo.endpoint", settings.endpoint);
									endpointRef.current = settings.endpoint;
									setSavingEndpoint(false);
								}}
							>
								{savingEndpoint ? "Saving..." : "Save Endpoint"}
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
			<p className="text-xs text-yellow-400">Changes may take up to 60 seconds to propagate.</p>
		</div>
	);
}
