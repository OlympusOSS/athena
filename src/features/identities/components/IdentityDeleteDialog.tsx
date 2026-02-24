import type { Identity } from "@ory/kratos-client";
import type React from "react";
import { Alert, AlertDescription, Icon } from "@olympus/canvas";
import { Badge } from "@olympus/canvas";
import { Button } from "@olympus/canvas";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@olympus/canvas";
import { uiLogger } from "@/lib/logger";
import { useDeleteIdentity } from "../hooks/useIdentities";

interface IdentityDeleteDialogProps {
	open: boolean;
	onClose: () => void;
	identity: Identity | null;
	onSuccess?: () => void;
}

export const IdentityDeleteDialog: React.FC<IdentityDeleteDialogProps> = ({ open, onClose, identity, onSuccess }) => {
	const deleteIdentityMutation = useDeleteIdentity();

	const handleDelete = async () => {
		if (!identity) return;

		try {
			await deleteIdentityMutation.mutateAsync(identity.id);
			onSuccess?.();
			onClose();
		} catch (error) {
			uiLogger.logError(error, "Failed to delete identity");
		}
	};

	if (!identity) return null;

	const traits = identity.traits as Record<string, unknown>;
	const name = traits?.name as Record<string, string> | undefined;
	const displayName =
		name?.first && name?.last ? `${name.first} ${name.last}` : (traits?.username as string) || (traits?.email as string) || "Unknown User";

	return (
		<Dialog open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) onClose(); }}>
			<DialogContent
				onInteractOutside={(e: Event) => { if (deleteIdentityMutation.isPending) e.preventDefault(); }}
			>
				<DialogHeader>
					<DialogTitle>Delete Identity</DialogTitle>
					<DialogDescription>
						Confirm deletion of identity
					</DialogDescription>
				</DialogHeader>

				<div>
					<p>
						Are you sure you want to delete this identity? This action cannot be undone.
					</p>

					{/* Identity Information */}
					<div>
						<div>
							<h4>{displayName}</h4>
							<Badge variant="outline">{identity.schema_id}</Badge>
						</div>

						<code>ID: {identity.id}</code>

						{(traits?.email as string) && (
							<p>Email: {traits.email as string}</p>
						)}

						{(traits?.username as string) && (
							<p>Username: {traits.username as string}</p>
						)}
					</div>

					<Alert variant="destructive">
						<Icon name="danger" />
						<AlertDescription>
							<p>
								<strong>Warning:</strong> Deleting this identity will:
							</p>
							<ul>
								<li>Permanently remove all identity data</li>
								<li>Revoke all active sessions</li>
								<li>Remove all verifiable addresses</li>
								<li>Delete all recovery addresses</li>
							</ul>
						</AlertDescription>
					</Alert>

					{deleteIdentityMutation.isError && (
						<Alert variant="destructive">
							<AlertDescription>
								Failed to delete identity: {(deleteIdentityMutation.error as Error)?.message || "Unknown error"}
							</AlertDescription>
						</Alert>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={onClose}
							disabled={deleteIdentityMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={deleteIdentityMutation.isPending}
						>
							{deleteIdentityMutation.isPending ? "Deleting..." : "Delete Identity"}
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default IdentityDeleteDialog;
