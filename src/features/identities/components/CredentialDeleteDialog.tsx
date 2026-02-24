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
import { useDeleteIdentityCredentials } from "../hooks/useIdentities";

const CREDENTIAL_TYPE_LABELS: Record<string, string> = {
	password: "Password",
	oidc: "Social Sign-In (OIDC)",
	totp: "TOTP (Authenticator App)",
	lookup_secret: "Lookup Secrets (Backup Codes)",
	webauthn: "WebAuthn (Security Key)",
	passkey: "Passkey",
	code: "Code",
	profile: "Profile",
	saml: "SAML",
	link_recovery: "Recovery Link",
	code_recovery: "Recovery Code",
};

const TYPES_REQUIRING_IDENTIFIER = new Set(["oidc", "saml"]);

interface CredentialDeleteDialogProps {
	open: boolean;
	onClose: () => void;
	identityId: string;
	credentialType: string;
	identifier?: string;
	onSuccess?: () => void;
}

export const CredentialDeleteDialog: React.FC<CredentialDeleteDialogProps> = ({
	open,
	onClose,
	identityId,
	credentialType,
	identifier,
	onSuccess,
}) => {
	const deleteCredentialMutation = useDeleteIdentityCredentials();

	const handleDelete = async () => {
		try {
			await deleteCredentialMutation.mutateAsync({
				id: identityId,
				type: credentialType as any,
				...(TYPES_REQUIRING_IDENTIFIER.has(credentialType) && identifier ? { identifier } : {}),
			});
			onSuccess?.();
			onClose();
		} catch (error) {
			uiLogger.logError(error, "Failed to delete credential");
		}
	};

	const typeLabel = CREDENTIAL_TYPE_LABELS[credentialType] || credentialType;

	return (
		<Dialog open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) onClose(); }}>
			<DialogContent
				onInteractOutside={(e: Event) => { if (deleteCredentialMutation.isPending) e.preventDefault(); }}
			>
				<DialogHeader>
					<DialogTitle>Delete Credential</DialogTitle>
					<DialogDescription>
						Confirm deletion of credential
					</DialogDescription>
				</DialogHeader>

				<div>
					<p>
						Are you sure you want to delete this credential? This action cannot be undone.
					</p>

					{/* Credential Information */}
					<div>
						<div>
							<h4>Credential</h4>
							<Badge variant="outline">{typeLabel}</Badge>
						</div>

						{identifier && (
							<div>
								<p>Identifier:</p>
								<code>{identifier}</code>
							</div>
						)}
					</div>

					<Alert variant="destructive">
						<Icon name="danger" />
						<AlertDescription>
							<p>
								<strong>Warning:</strong> Deleting this credential will:
							</p>
							<ul>
								<li>Permanently remove this {typeLabel.toLowerCase()} credential</li>
								<li>Prevent the user from authenticating with this method</li>
								{credentialType === "oidc" && <li>Disconnect the linked social sign-in provider</li>}
								{credentialType === "totp" && <li>Disable two-factor authentication via authenticator app</li>}
								{credentialType === "webauthn" && <li>Remove the registered security key</li>}
								{credentialType === "lookup_secret" && <li>Invalidate all backup codes</li>}
							</ul>
						</AlertDescription>
					</Alert>

					{deleteCredentialMutation.isError && (
						<Alert variant="destructive">
							<AlertDescription>
								Failed to delete credential: {(deleteCredentialMutation.error as Error)?.message || "Unknown error"}
							</AlertDescription>
						</Alert>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={onClose}
							disabled={deleteCredentialMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={deleteCredentialMutation.isPending}
						>
							{deleteCredentialMutation.isPending ? "Deleting..." : "Delete Credential"}
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default CredentialDeleteDialog;
