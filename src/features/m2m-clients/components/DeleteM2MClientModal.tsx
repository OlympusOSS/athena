"use client";

/**
 * DeleteM2MClientModal — Blocking confirmation before deleting an M2M client.
 *
 * Shows the client name in the confirmation prompt (per PO AC6).
 * Deletion immediately deregisters the client from Hydra — subsequent token
 * requests with that client_id return 401.
 */

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

interface DeleteM2MClientModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<void>;
	clientName?: string;
	clientId: string;
	isDeleting?: boolean;
	error?: Error | null;
}

export function DeleteM2MClientModal({ open, onOpenChange, onConfirm, clientName, clientId, isDeleting = false, error }: DeleteM2MClientModalProps) {
	const displayName = clientName || clientId;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						<Icon name="Trash2" />
						Delete M2M Client
					</DialogTitle>
					<DialogDescription>
						Deleting <strong>&quot;{displayName}&quot;</strong> will immediately revoke its access. This cannot be undone.
					</DialogDescription>
				</DialogHeader>

				<Alert variant="destructive">
					<AlertDescription>
						<Icon name="TriangleAlert" />
						Any AI agent or automated service currently using this client will immediately lose access. Existing access tokens remain valid until
						their natural expiry.
					</AlertDescription>
				</Alert>

				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
						Cancel
					</Button>
					<Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
						{isDeleting ? (
							<>
								<Icon name="LoaderCircle" />
								Deleting...
							</>
						) : (
							<>
								<Icon name="Trash2" />
								Delete Client
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
