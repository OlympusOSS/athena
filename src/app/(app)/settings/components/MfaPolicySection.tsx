"use client";

import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	cn,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Icon,
	Input,
	Label,
	Switch,
} from "@olympusoss/canvas";
import { useCallback, useEffect, useRef, useState } from "react";

type MfaMethod = "totp" | "webauthn" | "sms";

interface MfaPolicySettings {
	requireMfa: boolean;
	allowSelfEnroll: boolean;
	methods: MfaMethod[];
	gracePeriodDays: number;
}

interface MfaStats {
	available: boolean;
	enrolled: number;
	total: number;
	rate: number;
}

interface MfaPolicySectionProps {
	/** Called by the parent when it needs to know if navigation away is safe. */
	onDirtyChange?: (isDirty: boolean) => void;
}

// Only TOTP is interactive in V1. WebAuthn and SMS are V2 — shown as Coming Soon.
const INTERACTIVE_METHODS: { id: MfaMethod; label: string; description: string }[] = [
	{ id: "totp", label: "TOTP (Authenticator App)", description: "Time-based one-time passwords via apps like Google Authenticator" },
];

const COMING_SOON_METHODS: { id: MfaMethod; label: string; description: string }[] = [
	{ id: "webauthn", label: "WebAuthn / Passkey", description: "Hardware security keys and platform authenticators (biometrics)" },
	{ id: "sms", label: "SMS", description: "One-time codes sent via text message" },
];

const DEFAULT_SETTINGS: MfaPolicySettings = {
	requireMfa: false,
	allowSelfEnroll: true,
	// Only TOTP is active in V1; webauthn/sms are V2 (Coming Soon)
	methods: ["totp"],
	gracePeriodDays: 0,
};

function settingsEqual(a: MfaPolicySettings, b: MfaPolicySettings): boolean {
	return (
		a.requireMfa === b.requireMfa &&
		a.allowSelfEnroll === b.allowSelfEnroll &&
		a.gracePeriodDays === b.gracePeriodDays &&
		a.methods.length === b.methods.length &&
		a.methods.every((m) => b.methods.includes(m))
	);
}

export function MfaPolicySection({ onDirtyChange }: MfaPolicySectionProps) {
	const [settings, setSettings] = useState<MfaPolicySettings>(DEFAULT_SETTINGS);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [isDirty, setIsDirty] = useState(false);

	// SR-MFA-2: confirmation modal state
	const [showConfirmModal, setShowConfirmModal] = useState(false);

	// MFA stats
	const [stats, setStats] = useState<MfaStats | null>(null);
	const [statsError, setStatsError] = useState(false);

	// SR-MFA-2: last-fetched persisted state — used to restore form on Cancel.
	// A ref (not state) so updates do not trigger re-renders.
	// Null until the first successful fetchSettings() resolves.
	const persistedSettings = useRef<MfaPolicySettings | null>(null);

	// Guard C (SR-MFA-1): Save is disabled when MFA is required but no methods are enabled.
	// This mirrors the server-side invariant check in POST /api/settings/batch.
	const mfaInvariantViolation = settings.requireMfa && settings.methods.length === 0;
	// Save is enabled only when there are unsaved changes and no invariant violation.
	const saveDisabled = saving || mfaInvariantViolation || !isDirty;

	// Propagate dirty state to parent (for tab navigation interception)
	useEffect(() => {
		onDirtyChange?.(isDirty);
	}, [isDirty, onDirtyChange]);

	// Guard C: intercept browser close/reload when dirty
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (isDirty) {
				e.preventDefault();
				e.returnValue = "";
			}
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [isDirty]);

	const fetchSettings = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const res = await fetch("/api/settings?category=mfa");
			if (!res.ok) throw new Error("Failed to fetch MFA settings");
			const data = await res.json();
			const map: Record<string, string> = {};
			for (const s of data.settings || []) map[s.key] = s.value;

			// Transparent self-healing migration: mfa.require_mfa → mfa.required
			// If the new key is absent but the old stale key is present, migrate it.
			// This runs once on the first page load after deployment in any environment
			// that previously stored settings under the old key name.
			if (!("mfa.required" in map) && "mfa.require_mfa" in map) {
				const oldValue = map["mfa.require_mfa"];
				try {
					// Write the canonical key with the value from the stale key
					await fetch("/api/settings", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ key: "mfa.required", value: oldValue, encrypted: false, category: "mfa" }),
					});
					// Delete the stale key
					await fetch("/api/settings/mfa.require_mfa", { method: "DELETE" });
					// Update the local map so the rest of the parse logic sees the migrated value
					map["mfa.required"] = oldValue;
					delete map["mfa.require_mfa"];
					console.info("Migrated MFA setting key: mfa.require_mfa → mfa.required");
				} catch {
					// Migration failure is non-fatal — log and continue with the old value
					console.warn("Failed to migrate MFA setting key mfa.require_mfa → mfa.required; falling back to stale key value");
					map["mfa.required"] = oldValue;
				}
			}

			const rawMethods = map["mfa.methods"] || "totp";
			const parsedMethods = rawMethods
				.split(",")
				.map((m: string) => m.trim())
				// V1: only "totp" is a valid interactive method — filter out v2 methods
				.filter((m: string): m is MfaMethod => ["totp"].includes(m));

			const gracePeriod = Number.parseInt(map["mfa.grace_period_days"] || "0", 10);

			const fetchedSettings: MfaPolicySettings = {
				requireMfa: map["mfa.required"] === "true",
				allowSelfEnroll: map["mfa.allow_self_enroll"] !== "false",
				methods: parsedMethods.length > 0 ? parsedMethods : ["totp"],
				gracePeriodDays: Number.isNaN(gracePeriod) || gracePeriod < 0 ? 0 : gracePeriod,
			};
			// SR-MFA-2: seed the persisted ref so Cancel can restore to DB state
			persistedSettings.current = fetchedSettings;
			setSettings(fetchedSettings);
			setIsDirty(false);
		} catch {
			setError("Failed to load MFA policy settings");
		} finally {
			setLoading(false);
		}
	}, []);

	const fetchStats = useCallback(async () => {
		try {
			setStatsError(false);
			const res = await fetch("/api/mfa/stats");
			if (!res.ok) throw new Error("Stats unavailable");
			const data = await res.json();
			setStats(data);
		} catch {
			setStatsError(true);
		}
	}, []);

	useEffect(() => {
		fetchSettings();
		fetchStats();
	}, [fetchSettings, fetchStats]);

	// Track dirty state whenever settings change relative to persisted state
	useEffect(() => {
		if (persistedSettings.current === null) return;
		setIsDirty(!settingsEqual(settings, persistedSettings.current));
	}, [settings]);

	/**
	 * Execute the actual batch save to the API.
	 * Called directly on non-modal paths, and from the modal's onConfirm handler.
	 */
	const executeSave = useCallback(async () => {
		setSaving(true);
		setSaveSuccess(false);
		setError(null);

		try {
			const entries = [
				{ key: "mfa.required", value: String(settings.requireMfa), encrypted: false, category: "mfa" },
				{ key: "mfa.allow_self_enroll", value: String(settings.allowSelfEnroll), encrypted: false, category: "mfa" },
				{ key: "mfa.methods", value: settings.methods.join(","), encrypted: false, category: "mfa" },
				{ key: "mfa.grace_period_days", value: String(settings.gracePeriodDays), encrypted: false, category: "mfa" },
			];

			const res = await fetch("/api/settings/batch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(entries),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error || `Server responded with ${res.status}`);
			}

			// SR-MFA-2: update persisted ref to newly-saved state after successful save
			persistedSettings.current = { ...settings };
			setIsDirty(false);
			setSaveSuccess(true);
			// Refresh stats after saving — policy changes may affect enrollment state
			fetchStats();
			setTimeout(() => setSaveSuccess(false), 4000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save MFA policy");
		} finally {
			setSaving(false);
		}
	}, [settings, fetchStats]);

	/**
	 * Save button handler.
	 * SR-MFA-2: evaluates the zero-grace-period trigger condition at save time.
	 * If requireMfa=true AND gracePeriodDays=0, shows confirmation modal first.
	 * Otherwise, calls executeSave directly.
	 */
	const handleSave = useCallback(() => {
		// SR-MFA-2: state-based trigger (not transition-based) — fires whenever
		// the resulting saved state would be 'mandatory MFA, zero grace period'.
		if (settings.requireMfa && settings.gracePeriodDays === 0) {
			setShowConfirmModal(true);
			return;
		}
		executeSave();
	}, [settings, executeSave]);

	/**
	 * SR-MFA-2: Cancel confirmation modal.
	 * Restores to last-persisted DB state (not the unsaved local state).
	 * If persistedSettings.current is null (fetch not yet complete), no-op.
	 */
	const handleCancelModal = useCallback(() => {
		setShowConfirmModal(false);
		if (persistedSettings.current !== null) {
			setSettings(persistedSettings.current);
			setIsDirty(false);
		}
	}, []);

	/**
	 * SR-MFA-2: Confirm modal — proceed with save.
	 */
	const handleConfirmModal = useCallback(() => {
		setShowConfirmModal(false);
		executeSave();
	}, [executeSave]);

	/* c8 ignore start -- V1 only ships TOTP as an interactive method. With a single
	 * INTERACTIVE_METHODS entry and "require at least one method" enforced by the
	 * `disabled={isLastEnabled}` UI guard (Switch never fires onCheckedChange),
	 * this handler is unreachable in V1. Kept in place for V2 when WebAuthn/SMS
	 * become interactive — remove this pragma then. */
	const toggleMethod = useCallback((method: MfaMethod) => {
		setSettings((prev) => {
			const has = prev.methods.includes(method);
			if (has && prev.methods.length === 1) {
				// Require at least one method
				return prev;
			}
			return {
				...prev,
				methods: has ? prev.methods.filter((m) => m !== method) : [...prev.methods, method],
			};
		});
	}, []);
	/* c8 ignore stop */

	const updateSettings = useCallback(<K extends keyof MfaPolicySettings>(key: K, value: MfaPolicySettings[K]) => {
		setSettings((prev) => ({ ...prev, [key]: value }));
	}, []);

	if (loading) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
					<Icon name="LoaderCircle" className="mr-2 h-4 w-4 animate-spin" />
					Loading MFA policy settings...
				</CardContent>
			</Card>
		);
	}

	const statsAvailable = stats !== null && stats.available !== false;
	const enrolledPercent = statsAvailable && stats && stats.total > 0 ? Math.round((stats.enrolled / stats.total) * 100) : 0;

	return (
		<div className="space-y-4">
			{/* SR-MFA-6: Browser-scope enforcement notice (non-dismissable, info) */}
			<Alert className="py-2">
				<Icon name="Info" className="h-4 w-4" />
				<AlertDescription className="text-xs">
					MFA enforcement applies to browser-based logins. API integrations and direct Kratos session flows are not covered by this policy.
				</AlertDescription>
			</Alert>

			{error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

			{saveSuccess && (
				<div className="rounded-md border border-green-500/50 bg-green-500/10 px-3 py-2 text-xs text-green-600 dark:text-green-400">
					MFA policy saved successfully.
				</div>
			)}

			{/* AC6: Unsaved changes indicator — visible whenever form is dirty */}
			{isDirty && (
				<div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
					<Icon name="TriangleAlert" className="h-3.5 w-3.5 flex-shrink-0" />
					<span>You have unsaved changes. Click "Save MFA Policy" to apply them.</span>
				</div>
			)}

			{/* AC8/AC9: MFA Stats section */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Icon name="ChartBar" className="h-4 w-4 text-muted-foreground" />
						<CardTitle className="text-base">Enrollment Statistics</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="pt-0">
					{statsError || (stats !== null && stats.available === false) ? (
						<div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
							Enrollment statistics are not available — exercise caution before enabling MFA for all users.
						</div>
					) : stats === null ? (
						<div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
							<Icon name="LoaderCircle" className="h-3.5 w-3.5 animate-spin" />
							Loading stats...
						</div>
					) : (
						<div className="space-y-3">
							<div className="flex items-baseline gap-2">
								<span className="text-2xl font-semibold tabular-nums">{stats.enrolled}</span>
								<span className="text-xs text-muted-foreground">
									/ {stats.total} users enrolled ({enrolledPercent}%)
								</span>
							</div>
							<div className="rounded-md border border-border divide-y divide-border text-xs">
								<div className="flex items-center justify-between px-3 py-2">
									<span className="text-muted-foreground">TOTP (Authenticator App)</span>
									<span className="font-medium tabular-nums">{stats.enrolled}</span>
								</div>
								<div className="flex items-center justify-between px-3 py-2">
									<span className="text-muted-foreground">WebAuthn / Passkey</span>
									<span className="font-medium tabular-nums">—</span>
								</div>
							</div>
							<p className="text-[11px] text-muted-foreground">WebAuthn / Passkey breakdown is not yet available. Coming in a future release.</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Enrollment policy */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Icon name="Shield" className="h-4 w-4 text-muted-foreground" />
						<CardTitle className="text-base">Enrollment Policy</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="pt-0 space-y-4">
					<div className={cn("flex items-center justify-between rounded-md border border-border px-3 py-3")}>
						<div className="space-y-0.5">
							<Label className="text-xs font-medium">Require MFA for all users</Label>
							<p className="text-[11px] text-muted-foreground">
								{settings.requireMfa
									? "MFA is mandatory — users must enroll before accessing their account."
									: "MFA is optional — users can choose to enable it."}
							</p>
						</div>
						<Switch checked={settings.requireMfa} onCheckedChange={(checked) => updateSettings("requireMfa", checked)} />
					</div>

					<div className={cn("flex items-center justify-between rounded-md border border-border px-3 py-3")}>
						<div className="space-y-0.5">
							<Label className="text-xs font-medium">Allow users to self-enroll</Label>
							<p className="text-[11px] text-muted-foreground">
								{settings.allowSelfEnroll
									? "Users can add MFA factors from their profile settings."
									: "Only administrators can enroll MFA for users."}
							</p>
						</div>
						<Switch checked={settings.allowSelfEnroll} onCheckedChange={(checked) => updateSettings("allowSelfEnroll", checked)} />
					</div>

					{settings.requireMfa && (
						<div className="space-y-1.5">
							<Label htmlFor="mfa-grace-period" className="text-xs font-medium">
								Grace period (days)
							</Label>
							<div className="relative">
								<Icon name="Timer" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
								<Input
									id="mfa-grace-period"
									type="number"
									min={0}
									max={90}
									value={settings.gracePeriodDays}
									onChange={(e) => {
										const val = Number.parseInt(e.target.value, 10);
										updateSettings("gracePeriodDays", Number.isNaN(val) || val < 0 ? 0 : Math.min(val, 90));
									}}
									className="pl-8 text-sm w-32"
								/>
							</div>
							<p className="text-xs text-muted-foreground">
								How many days new users can defer MFA enrollment after first login. Set to 0 to require immediate enrollment.
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Allowed methods */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Icon name="Key" className="h-4 w-4 text-muted-foreground" />
						<CardTitle className="text-base">Allowed MFA Methods</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="pt-0 space-y-3">
					<p className="text-xs text-muted-foreground pb-1">
						Select which MFA factors users are permitted to enroll. At least one method must be enabled.
					</p>

					{/* V1 interactive methods (TOTP only) */}
					{INTERACTIVE_METHODS.map(({ id, label, description }) => {
						const checked = settings.methods.includes(id);
						const isLastEnabled = checked && settings.methods.length === 1;
						return (
							<div
								key={id}
								className={cn("flex items-center justify-between rounded-md border border-border px-3 py-3", isLastEnabled && "opacity-60")}
							>
								<div className="space-y-0.5">
									<Label className="text-xs font-medium">{label}</Label>
									<p className="text-[11px] text-muted-foreground">{description}</p>
									{isLastEnabled && <p className="text-[11px] text-amber-500">At least one method must remain enabled.</p>}
								</div>
								{/* c8 ignore start -- TOTP Switch is always disabled (isLastEnabled)
								 * so this onCheckedChange never fires — see toggleMethod pragma. */}
								<Switch checked={checked} disabled={isLastEnabled} onCheckedChange={() => toggleMethod(id)} />
								{/* c8 ignore stop */}
							</div>
						);
					})}

					{/* V2 Coming Soon methods (WebAuthn, SMS) — non-interactive */}
					{COMING_SOON_METHODS.map(({ id, label, description }) => (
						<div key={id} className="flex items-center justify-between rounded-md border border-border px-3 py-3 opacity-60 cursor-not-allowed">
							<div className="space-y-0.5">
								<div className="flex items-center gap-2">
									<Label className="text-xs font-medium">{label}</Label>
									<Badge variant="secondary" className="text-[10px] px-1.5 py-0">
										Coming Soon
									</Badge>
								</div>
								<p className="text-[11px] text-muted-foreground">{description}</p>
								<p className="text-[11px] text-muted-foreground">This method will be available in a future release.</p>
							</div>
							{/* Non-interactive disabled switch — purely decorative/status indicator */}
							<Switch checked={false} disabled aria-disabled="true" />
						</div>
					))}

					{/* c8 ignore start -- mfaInvariantViolation requires `settings.methods` to be
					 * empty while `requireMfa` is true. The only interactive method (TOTP) is
					 * the "last enabled" method and its Switch is disabled — so methods can
					 * never drop to [] in V1. */}
					{mfaInvariantViolation && <p className="text-xs text-destructive pt-1">At least one MFA method must be enabled when MFA is required.</p>}
					{/* c8 ignore stop */}
				</CardContent>
			</Card>

			<Alert className="py-2">
				<AlertDescription className="text-xs">
					MFA policy changes apply to new logins. Existing sessions are not immediately invalidated. Changes may take up to 60 seconds to propagate
					across all services.
				</AlertDescription>
			</Alert>

			<div className="flex items-center justify-between">
				<div>
					{isDirty && (
						<Badge variant="secondary" className="text-[10px] px-1.5 py-0">
							Unsaved changes
						</Badge>
					)}
				</div>
				<Button size="sm" onClick={handleSave} disabled={saveDisabled}>
					{saving ? (
						<>
							<Icon name="LoaderCircle" className="mr-1.5 h-3.5 w-3.5 animate-spin" />
							Saving...
						</>
					) : (
						<>
							<Icon name="Check" className="mr-1.5 h-3.5 w-3.5" />
							Save MFA Policy
						</>
					)}
				</Button>
			</div>

			{/* SR-MFA-2: Zero-grace-period confirmation modal */}
			{/* c8 ignore start -- Radix Dialog onOpenChange fires on Escape /
			 * outside-click / overlay-click, which jsdom's lack of pointer-capture
			 * support cannot reliably fire. Explicit Cancel path is covered. */}
			<Dialog
				open={showConfirmModal}
				onOpenChange={(open) => {
					if (!open) handleCancelModal();
				}}
			>
				{/* c8 ignore stop */}
				<DialogContent className="glass-overlay max-w-md">
					<DialogHeader>
						<DialogTitle className="text-sm font-semibold">Confirm MFA Policy Change</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">This configuration requires your explicit confirmation.</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
							<p className="font-medium mb-1">No grace period — immediate enforcement</p>
							<p>
								Mandatory MFA with no grace period will be active after saving. Users who have not yet enrolled an MFA factor will be required to
								enroll on their next login. They will not be able to access their account until enrollment is complete.
							</p>
						</div>
						{statsAvailable && stats !== null ? (
							<p className="text-xs text-muted-foreground">
								Currently {stats.enrolled} of {stats.total} users have MFA enrolled ({enrolledPercent}%). Users without MFA will be required to enroll
								immediately.
							</p>
						) : (
							<p className="text-xs text-muted-foreground italic">
								Enrollment statistics are not available — exercise caution. Confirm only if you are certain of the impact on your users.
							</p>
						)}
						<p className="text-xs text-muted-foreground">Cancel will discard all unsaved changes.</p>
					</div>
					<DialogFooter className="gap-2">
						<Button variant="outline" size="sm" onClick={handleCancelModal}>
							Cancel
						</Button>
						<Button variant="destructive" size="sm" onClick={handleConfirmModal}>
							Save Policy
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export type { MfaPolicySectionProps };
