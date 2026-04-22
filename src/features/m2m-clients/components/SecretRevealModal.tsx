"use client";

/**
 * SecretRevealModal — One-time display of client_id and client_secret.
 *
 * SECURITY (SR-3 / athena#75):
 *   - The modal CANNOT be dismissed without explicit confirmation.
 *   - Pressing Escape and clicking outside the dialog are both intercepted and
 *     trigger a blocking interstitial, not a silent close.
 *   - The "Done" button is DISABLED until the admin checks the confirmation checkbox.
 *   - This pattern is intentionally stricter than a toast warning — for an irreversible
 *     action (secret will never be shown again), explicit confirmation is required.
 *
 * Implementation note (athena#50 comment #4174824453 / Orchestrator Note 2):
 *   `onOpenChange: () => false` does NOT block Radix dialog dismissal — returning a value
 *   from this callback has no effect. The correct pattern is `onEscapeKeyDown` and
 *   `onInteractOutside` with `e.preventDefault()` on DialogContent.
 *
 * Analytics:
 *   - AN-P16-5 / AN-50-1: admin.m2m_client.secret_acknowledged emitted on Done click
 *   - AN-50-2: admin.m2m_client.secret_modal_cancelled emitted on abandon confirm
 */

import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Icon,
	Label,
} from "@olympusoss/canvas";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCopyToClipboard } from "@/hooks";

interface SecretRevealModalProps {
	/** Whether the modal is open */
	open: boolean;
	/** Called when the admin confirms they have saved the secret and clicks Done */
	onDone: () => void;
	/** Called when the admin confirms they want to abandon (lose the secret) */
	onAbandon: () => void;
	/** The client_id to display */
	clientId: string;
	/** The client_secret to display (one-time only — not stored anywhere after this) */
	clientSecret: string;
	/** "creation" or "rotation" — affects the modal title */
	displayType: "creation" | "rotation";
}

export function SecretRevealModal({ open, onDone, onAbandon, clientId, clientSecret, displayType }: SecretRevealModalProps) {
	const { copy, copiedField } = useCopyToClipboard();
	const [confirmed, setConfirmed] = useState(false);
	const [showAbandonInterstitial, setShowAbandonInterstitial] = useState(false);
	const openedAtRef = useRef<number | null>(null);

	// Track when the modal opened for analytics time_on_modal_ms
	useEffect(() => {
		if (open) {
			openedAtRef.current = Date.now();
			setConfirmed(false);
			setShowAbandonInterstitial(false);
		}
	}, [open]);

	const handleDone = useCallback(() => {
		const timeOnModal = openedAtRef.current ? Date.now() - openedAtRef.current : 0;
		// AN-P16-5 / AN-50-1: emit secret_acknowledged event
		// This is a browser-side analytics event — no sensitive data included
		if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).__olympus_analytics) {
			((window as unknown as Record<string, unknown>).__olympus_analytics as (e: object) => void)({
				event: "admin.m2m_client.secret_acknowledged",
				client_id: clientId,
				display_type: displayType,
				time_on_modal_ms: timeOnModal,
			});
		}
		onDone();
	}, [clientId, displayType, onDone]);

	const handleEscapeOrOutside = useCallback((e: { preventDefault: () => void }) => {
		// SR-3: intercept Escape / outside-click — show blocking interstitial
		e.preventDefault();
		setShowAbandonInterstitial(true);
	}, []);

	const handleAbandonConfirm = useCallback(() => {
		const timeOnModal = openedAtRef.current ? Date.now() - openedAtRef.current : 0;
		// AN-50-2: emit secret_modal_cancelled event
		if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).__olympus_analytics) {
			((window as unknown as Record<string, unknown>).__olympus_analytics as (e: object) => void)({
				event: "admin.m2m_client.secret_modal_cancelled",
				client_id: clientId,
				display_type: displayType,
				time_on_modal_ms: timeOnModal,
			});
		}
		setShowAbandonInterstitial(false);
		onAbandon();
	}, [clientId, displayType, onAbandon]);

	const handleGoBack = useCallback(() => {
		setShowAbandonInterstitial(false);
	}, []);

	const title = displayType === "creation" ? "Client Created — Save Your Secret" : "Secret Rotated — Save Your New Secret";

	return (
		<Dialog open={open} onOpenChange={() => {}}>
			<DialogContent
				// SR-3 (athena#75): Block Escape key and outside clicks.
				// These events show the abandon interstitial instead of closing the modal.
				// Do NOT use onOpenChange to block — returning false has no effect in Radix.
				onEscapeKeyDown={handleEscapeOrOutside}
				onInteractOutside={handleEscapeOrOutside}
				// Prevent the X close button from being functional (hide it via the
				// [data-close] selector if Canvas Dialog exposes one, or override via
				// the onEscapeKeyDown/onInteractOutside pattern which catches all close paths)
			>
				{showAbandonInterstitial ? (
					// Blocking interstitial — admin must explicitly confirm abandonment
					<>
						<DialogHeader>
							<DialogTitle>
								<Icon name="TriangleAlert" />
								Are you sure?
							</DialogTitle>
							<DialogDescription>
								If you close this dialog now, the client secret will be permanently hidden. You will need to rotate the secret to get a new one.
							</DialogDescription>
						</DialogHeader>
						<Alert variant="destructive">
							<AlertDescription>
								<strong>This action cannot be undone.</strong> Any agent already configured with this client ID will need to be reconfigured with a
								new secret after rotation.
							</AlertDescription>
						</Alert>
						<DialogFooter>
							<Button variant="outline" onClick={handleGoBack}>
								<Icon name="ArrowLeft" />
								Go back — I still need to save the secret
							</Button>
							<Button variant="destructive" onClick={handleAbandonConfirm}>
								Close and lose the secret
							</Button>
						</DialogFooter>
					</>
				) : (
					// Main credential display
					<>
						<DialogHeader>
							<DialogTitle>
								<Icon name="KeyRound" />
								{title}
							</DialogTitle>
							<DialogDescription>
								Copy your client credentials now. <strong>The client secret will not be shown again.</strong>
							</DialogDescription>
						</DialogHeader>

						<Alert>
							<AlertDescription>
								<Icon name="ShieldAlert" />
								<strong>Save your secret in a password manager or secrets manager before closing this dialog.</strong> If you lose it, you will need
								to rotate the secret to generate a new one.
							</AlertDescription>
						</Alert>

						<div className="space-y-4">
							{/* Client ID */}
							<div className="space-y-1">
								<Label>Client ID</Label>
								<div className="flex items-center gap-2">
									<code className="flex-1 rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm text-foreground">{clientId}</code>
									<Button type="button" variant="outline" size="icon" onClick={() => copy(clientId, "client_id")} aria-label="Copy client ID">
										<Icon name={copiedField === "client_id" ? "Check" : "Copy"} />
									</Button>
								</div>
							</div>

							{/* Client Secret */}
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<Label>Client Secret</Label>
									<Badge variant="destructive">Shown once only</Badge>
								</div>
								<div className="flex items-center gap-2">
									<code className="flex-1 rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm text-foreground break-all">
										{clientSecret}
									</code>
									<Button
										type="button"
										variant="outline"
										size="icon"
										onClick={() => copy(clientSecret, "client_secret")}
										aria-label="Copy client secret"
									>
										<Icon name={copiedField === "client_secret" ? "Check" : "Copy"} />
									</Button>
								</div>
							</div>
						</div>

						{/* Confirmation checkbox — Done is disabled until checked */}
						<div className="flex items-start gap-3 rounded-md border border-border p-3">
							<Checkbox id="secret-saved-confirm" checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
							<Label htmlFor="secret-saved-confirm" className="cursor-pointer text-sm leading-relaxed">
								I have saved the client secret in a password manager or secrets manager. I understand it will not be shown again.
							</Label>
						</div>

						<DialogFooter>
							<Button type="button" onClick={handleDone} disabled={!confirmed} aria-disabled={!confirmed}>
								<Icon name="Check" />
								Done
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
