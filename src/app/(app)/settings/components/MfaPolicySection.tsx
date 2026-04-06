"use client";

import {
	Alert,
	AlertDescription,
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

const ALL_METHODS: { id: MfaMethod; label: string; description: string }[] = [
	{ id: "totp", label: "TOTP (Authenticator App)", description: "Time-based one-time passwords via apps like Google Authenticator" },
	{ id: "webauthn", label: "WebAuthn / Passkey", description: "Hardware security keys and platform authenticators (biometrics)" },
	{ id: "sms", label: "SMS", description: "One-time codes sent via text message" },
];

const DEFAULT_SETTINGS: MfaPolicySettings = {
	requireMfa: false,
	allowSelfEnroll: true,
	methods: ["totp", "webauthn"],
	gracePeriodDays: 7,
};

export function MfaPolicySection() {
	const [settings, setSettings] = useState<MfaPolicySettings>(DEFAULT_SETTINGS);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveSuccess, setSaveSuccess] = useState(false);
	// SR-MFA-2: confirmation modal state
	const [showConfirmModal, setShowConfirmModal] = useState(false);

	// SR-MFA-2: last-fetched persisted state — used to restore form on Cancel.
	// A ref (not state) so updates do not trigger re-renders.
	// Null until the first successful fetchSettings() resolves.
	const persistedSettings = useRef<MfaPolicySettings | null>(null);

	// Guard C (SR-MFA-1): Save is disabled when MFA is required but no methods are enabled.
	// This mirrors the server-side invariant check in POST /api/settings/batch.
	const mfaInvariantViolation = settings.requireMfa && settings.methods.length === 0;
	const saveDisabled = saving || mfaInvariantViolation;

	const fetchSettings = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const res = await fetch("/api/settings?category=mfa");
			if (!res.ok) throw new Error("Failed to fetch MFA settings");
			const data = await res.json();
			const map: Record<string, string> = {};
			for (const s of data.settings || []) map[s.key] = s.value;

			const rawMethods = map["mfa.methods"] || "totp,webauthn";
			const parsedMethods = rawMethods
				.split(",")
				.map((m: string) => m.trim())
				.filter((m: string): m is MfaMethod => ["totp", "webauthn", "sms"].includes(m));

			const gracePeriod = Number.parseInt(map["mfa.grace_period_days"] || "7", 10);

			const fetchedSettings: MfaPolicySettings = {
				requireMfa: map["mfa.require_mfa"] === "true",
				allowSelfEnroll: map["mfa.allow_self_enroll"] !== "false",
				methods: parsedMethods.length > 0 ? parsedMethods : ["totp", "webauthn"],
				gracePeriodDays: Number.isNaN(gracePeriod) || gracePeriod < 0 ? 7 : gracePeriod,
			};
			// SR-MFA-2: seed the persisted ref so Cancel can restore to DB state
			persistedSettings.current = fetchedSettings;
			setSettings(fetchedSettings);
		} catch {
			setError("Failed to load MFA policy settings");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchSettings();
	}, [fetchSettings]);

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
				{ key: "mfa.require_mfa", value: String(settings.requireMfa), encrypted: false, category: "mfa" },
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
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save MFA policy");
		} finally {
			setSaving(false);
		}
	}, [settings]);

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
		}
	}, []);

	/**
	 * SR-MFA-2: Confirm modal — proceed with save.
	 */
	const handleConfirmModal = useCallback(() => {
		setShowConfirmModal(false);
		executeSave();
	}, [executeSave]);

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

	if (loading) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center py-8 text-sm text-muted-foreground">
					<Icon name="loading" className="mr-2 h-4 w-4 animate-spin" />
					Loading MFA policy settings...
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			{error && <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
			{saveSuccess && (
				<div className="rounded-md border border-green-500/50 bg-green-500/10 px-3 py-2 text-xs text-green-600 dark:text-green-400">
					MFA policy saved successfully.
				</div>
			)}

			{/* Enrollment policy */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Icon name="shield" className="h-4 w-4 text-muted-foreground" />
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
						<Switch checked={settings.requireMfa} onCheckedChange={(checked) => setSettings((s) => ({ ...s, requireMfa: checked }))} />
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
						<Switch checked={settings.allowSelfEnroll} onCheckedChange={(checked) => setSettings((s) => ({ ...s, allowSelfEnroll: checked }))} />
					</div>

					{settings.requireMfa && (
						<div className="space-y-1.5">
							<Label htmlFor="mfa-grace-period" className="text-xs font-medium">
								Grace period (days)
							</Label>
							<div className="relative">
								<Icon name="time" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
								<Input
									id="mfa-grace-period"
									type="number"
									min={0}
									max={90}
									value={settings.gracePeriodDays}
									onChange={(e) => {
										const val = Number.parseInt(e.target.value, 10);
										setSettings((s) => ({ ...s, gracePeriodDays: Number.isNaN(val) || val < 0 ? 0 : Math.min(val, 90) }));
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
						<Icon name="key" className="h-4 w-4 text-muted-foreground" />
						<CardTitle className="text-base">Allowed MFA Methods</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="pt-0 space-y-3">
					<p className="text-xs text-muted-foreground pb-1">
						Select which MFA factors users are permitted to enroll. At least one method must be enabled.
					</p>
					{ALL_METHODS.map(({ id, label, description }) => {
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
								<Switch checked={checked} disabled={isLastEnabled} onCheckedChange={() => toggleMethod(id)} />
							</div>
						);
					})}
					{mfaInvariantViolation && <p className="text-xs text-destructive pt-1">At least one MFA method must be enabled when MFA is required.</p>}
				</CardContent>
			</Card>

			<Alert className="py-2">
				<AlertDescription className="text-xs">
					MFA policy changes apply to new logins. Existing sessions are not immediately invalidated. Changes may take up to 60 seconds to propagate
					across all services.
				</AlertDescription>
			</Alert>

			<div className="flex justify-end">
				<Button size="sm" onClick={handleSave} disabled={saveDisabled}>
					{saving ? (
						<>
							<Icon name="loading" className="mr-1.5 h-3.5 w-3.5 animate-spin" />
							Saving...
						</>
					) : (
						<>
							<Icon name="check" className="mr-1.5 h-3.5 w-3.5" />
							Save MFA Policy
						</>
					)}
				</Button>
			</div>

			{/* SR-MFA-2: Zero-grace-period confirmation modal */}
			<Dialog
				open={showConfirmModal}
				onOpenChange={(open) => {
					if (!open) handleCancelModal();
				}}
			>
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
						{/* Stats slot — reserved for Guard A story to populate with enrollment counts */}
						<p className="text-xs text-muted-foreground italic">Enrollment statistics are not yet available.</p>
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
