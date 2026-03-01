import {
	Alert,
	AlertDescription,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Icon,
} from "@olympusoss/canvas";
import type { Identity } from "@ory/kratos-client";
import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useState } from "react";
import { isDemoIdentity } from "@/lib/demo";
import { deleteIdentity, patchIdentity } from "@/services/kratos/endpoints/identities";
import { deleteIdentitySessions } from "@/services/kratos/endpoints/sessions";

type BulkOperationType = "delete" | "deleteSessions" | "activate" | "deactivate";

interface BulkOperationDialogProps {
	open: boolean;
	onClose: () => void;
	operationType: BulkOperationType;
	identityIds: string[];
	identities: Identity[];
	onSuccess: () => void;
}

const OPERATION_CONFIG: Record<BulkOperationType, { title: string; warning: string; confirmLabel: string; processingLabel: string }> = {
	delete: {
		title: "Delete Identities",
		warning:
			"This will permanently delete the selected identities, including all their sessions, credentials, and recovery addresses. This action cannot be undone.",
		confirmLabel: "Delete",
		processingLabel: "Deleting",
	},
	deleteSessions: {
		title: "Delete Sessions",
		warning: "This will revoke all active sessions for the selected identities. Users will be logged out immediately.",
		confirmLabel: "Delete Sessions",
		processingLabel: "Deleting sessions for",
	},
	activate: {
		title: "Activate Identities",
		warning: "This will set the selected identities to the active state, allowing them to sign in.",
		confirmLabel: "Activate",
		processingLabel: "Activating",
	},
	deactivate: {
		title: "Deactivate Identities",
		warning: "This will set the selected identities to the inactive state. They will no longer be able to sign in.",
		confirmLabel: "Deactivate",
		processingLabel: "Deactivating",
	},
};

function getDisplayName(identity: Identity): string {
	const traits = identity.traits as Record<string, unknown>;
	const name = traits?.name as Record<string, string> | undefined;
	return (
		(name?.first && name?.last ? `${name.first} ${name.last}` : null) ||
		(traits?.email as string) ||
		(traits?.username as string) ||
		`${identity.id.substring(0, 8)}...`
	);
}

async function executeOperation(type: BulkOperationType, identityId: string): Promise<void> {
	switch (type) {
		case "delete":
			await deleteIdentity({ id: identityId });
			break;
		case "deleteSessions":
			await deleteIdentitySessions(identityId);
			break;
		case "activate":
			await patchIdentity({
				id: identityId,
				jsonPatch: [{ op: "replace", path: "/state", value: "active" }],
			});
			break;
		case "deactivate":
			await patchIdentity({
				id: identityId,
				jsonPatch: [{ op: "replace", path: "/state", value: "inactive" }],
			});
			break;
	}
}

const INVALIDATION_KEYS: Record<BulkOperationType, string[][]> = {
	delete: [["identities"], ["identities-search"]],
	deleteSessions: [["identity-sessions"], ["sessions"]],
	activate: [["identities"], ["identities-search"]],
	deactivate: [["identities"], ["identities-search"]],
};

type Phase = "confirm" | "processing" | "complete";

export const BulkOperationDialog: React.FC<BulkOperationDialogProps> = ({ open, onClose, operationType, identityIds, identities, onSuccess }) => {
	const queryClient = useQueryClient();
	const [phase, setPhase] = useState<Phase>("confirm");
	const [progress, setProgress] = useState(0);
	const [succeeded, setSucceeded] = useState(0);
	const [errors, setErrors] = useState<Array<{ id: string; message: string }>>([]);
	const [showErrors, setShowErrors] = useState(false);

	const config = OPERATION_CONFIG[operationType];
	const displayIdentities = identities.filter((i) => identityIds.includes(i.id));
	const demoCount = operationType === "delete" ? displayIdentities.filter((i) => isDemoIdentity(i)).length : 0;
	const shown = displayIdentities.slice(0, 5);
	const remaining = displayIdentities.length - shown.length;

	const resetState = useCallback(() => {
		setPhase("confirm");
		setProgress(0);
		setSucceeded(0);
		setErrors([]);
		setShowErrors(false);
	}, []);

	const handleClose = useCallback(() => {
		if (phase === "processing") return;
		resetState();
		onClose();
	}, [phase, resetState, onClose]);

	const handleConfirm = useCallback(async () => {
		setPhase("processing");
		setProgress(0);
		setSucceeded(0);
		setErrors([]);

		const total = identityIds.length;
		let successCount = 0;
		const errorList: Array<{ id: string; message: string }> = [];

		for (let i = 0; i < total; i++) {
			const id = identityIds[i];
			// Skip demo identities for delete operations
			if (operationType === "delete") {
				const identity = identities.find((ident) => ident.id === id);
				if (isDemoIdentity(identity)) {
					errorList.push({ id, message: "Protected demo account — skipped" });
					setProgress(((i + 1) / total) * 100);
					setErrors([...errorList]);
					continue;
				}
			}
			try {
				await executeOperation(operationType, id);
				successCount++;
			} catch (err: unknown) {
				errorList.push({
					id,
					message: (err as Error)?.message || "Unknown error",
				});
			}
			setProgress(((i + 1) / total) * 100);
			setSucceeded(successCount);
			setErrors([...errorList]);
		}

		// Invalidate relevant queries
		const keys = INVALIDATION_KEYS[operationType];
		for (const key of keys) {
			queryClient.invalidateQueries({ queryKey: key });
		}

		setPhase("complete");

		if (errorList.length === 0) {
			onSuccess();
		}
	}, [identityIds, operationType, queryClient, onSuccess]);

	const handleDone = useCallback(() => {
		resetState();
		onClose();
	}, [resetState, onClose]);

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen: boolean) => {
				if (!isOpen) handleClose();
			}}
		>
			<DialogContent
				onInteractOutside={(e: Event) => {
					if (phase === "processing") e.preventDefault();
				}}
			>
				<DialogHeader>
					<DialogTitle>{config.title}</DialogTitle>
					<DialogDescription>{config.warning}</DialogDescription>
				</DialogHeader>

				{phase === "confirm" && (
					<div>
						<Alert variant={operationType === "activate" ? "default" : "destructive"}>
							{operationType === "activate" ? <Icon name="info" /> : <Icon name="danger" />}
							<AlertDescription>{config.warning}</AlertDescription>
						</Alert>

						<div>
							<p>
								{identityIds.length} {identityIds.length === 1 ? "identity" : "identities"} selected:
							</p>
							<ul>
								{shown.map((identity) => (
									<li key={identity.id}>
										{getDisplayName(identity)} <code>{identity.id.substring(0, 8)}...</code>
									</li>
								))}
								{remaining > 0 && <li>+{remaining} more</li>}
							</ul>
						</div>

						{demoCount > 0 && (
							<Alert>
								<Icon name="lock" />
								<AlertDescription>
									{demoCount} demo {demoCount === 1 ? "account is" : "accounts are"} protected and will be skipped.
								</AlertDescription>
							</Alert>
						)}

						<DialogFooter>
							<Button variant="outline" onClick={handleClose}>
								Cancel
							</Button>
							<Button variant={operationType === "delete" ? "destructive" : "default"} onClick={handleConfirm}>
								{config.confirmLabel}
							</Button>
						</DialogFooter>
					</div>
				)}

				{phase === "processing" && (
					<div>
						<p>
							{config.processingLabel}{" "}
							{progress < 100
								? `${Math.round(progress / (100 / identityIds.length))} of ${identityIds.length}`
								: `${identityIds.length} of ${identityIds.length}`}
							...
						</p>
						<div>
							<div style={{ width: `${progress}%` }} />
						</div>
						<p>{Math.round(progress)}% complete</p>
					</div>
				)}

				{phase === "complete" && (
					<div>
						{errors.length === 0 ? (
							<Alert>
								<Icon name="success" />
								<AlertDescription>
									Successfully processed {succeeded} {succeeded === 1 ? "identity" : "identities"}.
								</AlertDescription>
							</Alert>
						) : (
							<>
								<Alert variant="destructive">
									<Icon name="danger" />
									<AlertDescription>
										{succeeded} succeeded, {errors.length} failed.
									</AlertDescription>
								</Alert>
								<div>
									<button type="button" onClick={() => setShowErrors((v) => !v)}>
										{showErrors ? "Hide errors" : "Show errors"}
									</button>
									{showErrors && (
										<div>
											{errors.map((err) => (
												<p key={err.id}>
													<code>{err.id.substring(0, 8)}...</code> &mdash; {err.message}
												</p>
											))}
										</div>
									)}
								</div>
							</>
						)}

						<DialogFooter>
							<Button onClick={handleDone}>Close</Button>
						</DialogFooter>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};

export default BulkOperationDialog;
