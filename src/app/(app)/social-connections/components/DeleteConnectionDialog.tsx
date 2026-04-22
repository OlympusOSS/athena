"use client";

import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Icon } from "@olympusoss/canvas";
import { useEffect, useRef, useState } from "react";
import { useDeleteSocialConnection } from "@/hooks/useSocialConnections";
import type { ReloadStatus } from "@/lib/social-connections/reload-client";

/**
 * DeleteConnectionDialog (athena#49 T16)
 *
 * Confirmation dialog for social connection deletion.
 *
 * Security requirements from Security Review:
 * - Must explicitly state user lockout impact (V8 mitigation)
 * - Must NOT promise session revocation (sessions are not revoked on deletion)
 * - Shows affected user count as best-effort with 5s timeout (DA C2 mitigation)
 *
 * Dialog text matches QA test assertion F20:
 * "Users who have only logged in via Google will not be able to log in after
 *  deletion. Their accounts will remain intact. You can re-add Google as a
 *  provider to restore access."
 */

interface DeleteConnectionDialogProps {
	open: boolean;
	provider: string;
	onSuccess: (reloadStatus: ReloadStatus) => void;
	onCancel: () => void;
}

interface UserCountResult {
	count: number | null;
	available: boolean;
}

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
	google: "Google",
	github: "GitHub",
	microsoft: "Microsoft",
	linkedin: "LinkedIn",
	facebook: "Facebook",
	apple: "Apple",
};

export function DeleteConnectionDialog({ open, provider, onSuccess, onCancel }: DeleteConnectionDialogProps) {
	const deleteMutation = useDeleteSocialConnection();
	const [userCount, setUserCount] = useState<UserCountResult>({ count: null, available: false });
	const [countLoading, setCountLoading] = useState(false);
	const dialogOpenedAt = useRef<number>(0);

	const displayName = PROVIDER_DISPLAY_NAMES[provider] ?? provider;

	// Fetch affected user count when dialog opens (best-effort, 5s timeout)
	useEffect(() => {
		if (!open) return;

		dialogOpenedAt.current = Date.now();
		setUserCount({ count: null, available: false });
		setCountLoading(true);

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout (DA C2 mitigation)

		fetch(`/api/kratos-admin/identities?per_page=1&page=1`, { signal: controller.signal })
			.then((res) => {
				if (!res.ok) throw new Error("Failed to fetch identity count");
				// Kratos returns X-Total-Count header for count-only queries
				const total = res.headers.get("X-Total-Count");
				if (total !== null) {
					// This is an approximation — exact per-provider count requires filtering
					// which Kratos does not expose efficiently. Show total as a conservative upper bound.
					setUserCount({ count: Number.parseInt(total, 10), available: true });
				} else {
					setUserCount({ count: null, available: false });
				}
			})
			.catch(() => {
				// Timeout or fetch error — dialog still renders (DA C2 mitigation)
				setUserCount({ count: null, available: false });
			})
			.finally(() => {
				setCountLoading(false);
				clearTimeout(timeoutId);
			});

		return () => {
			clearTimeout(timeoutId);
			controller.abort();
		};
	}, [open]);

	const handleConfirm = () => {
		deleteMutation.mutate(provider, {
			onSuccess: (result) => {
				onSuccess(result.reloadStatus);
			},
		});
	};

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-destructive">
						<Icon name="TriangleAlert" className="h-5 w-5" />
						Remove {displayName} Connection
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{/* Required impact statement (Security Review V8 — exact text from F20/F21) */}
					<Alert variant="destructive">
						<Icon name="TriangleAlert" />
						<AlertDescription>
							<p>
								<strong>Users who have only logged in via {displayName} will not be able to log in after deletion.</strong> Their accounts will remain
								intact. You can re-add {displayName} as a provider to restore access.
							</p>
						</AlertDescription>
					</Alert>

					{/* Session clarification — must NOT promise revocation (F21) */}
					<p className="text-sm text-muted-foreground">
						Existing user sessions will remain valid until they naturally expire. After deletion, users will not be able to start new sessions via{" "}
						{displayName}.
					</p>

					{/* Affected user count (best-effort, 5s timeout per DA C2) */}
					<div className="rounded-lg border border-border bg-muted/50 p-4">
						<div className="flex items-center gap-2 text-sm">
							<Icon name="Users" className="h-4 w-4 text-muted-foreground" />
							<span className="font-medium">Potentially affected users:</span>
							{countLoading ? (
								<span className="text-muted-foreground">
									<Icon name="LoaderCircle" className="h-3 w-3 animate-spin inline" /> Checking...
								</span>
							) : userCount.available && userCount.count !== null ? (
								<span className="text-destructive font-medium">{userCount.count.toLocaleString()}</span>
							) : (
								<span className="text-muted-foreground italic">Unable to determine affected user count</span>
							)}
						</div>
						{!countLoading && !userCount.available && (
							<p className="mt-1 text-xs text-muted-foreground">
								The identity count query timed out. Proceed with caution — affected users will lose login access.
							</p>
						)}
					</div>

					{/* API error */}
					{deleteMutation.isError && (
						<Alert variant="destructive">
							<Icon name="TriangleAlert" />
							<AlertDescription>{deleteMutation.error?.message ?? "Failed to delete connection. Please try again."}</AlertDescription>
						</Alert>
					)}
				</div>

				<DialogFooter>
					<Button type="button" variant="outline" onClick={onCancel} disabled={deleteMutation.isPending}>
						Cancel
					</Button>
					<Button type="button" variant="destructive" onClick={handleConfirm} disabled={deleteMutation.isPending}>
						{deleteMutation.isPending ? (
							<>
								<Icon name="LoaderCircle" className="h-4 w-4 animate-spin" />
								Removing...
							</>
						) : (
							<>
								<Icon name="Trash2" className="h-4 w-4" />
								Remove {displayName}
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
