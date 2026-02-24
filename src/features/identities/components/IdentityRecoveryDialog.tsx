import type { Identity } from "@ory/kratos-client";
import type React from "react";
import { useState } from "react";
import { Alert, AlertDescription, Icon } from "@olympus/canvas";
import { Button } from "@olympus/canvas";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@olympus/canvas";
import { Label } from "@olympus/canvas";
import { createRecoveryLink } from "@/services/kratos";
import { cn } from "@olympus/canvas";

interface IdentityRecoveryDialogProps {
	open: boolean;
	onClose: () => void;
	identity: Identity | null;
}

export const IdentityRecoveryDialog: React.FC<IdentityRecoveryDialogProps> = ({ open, onClose, identity }) => {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [recoveryLink, setRecoveryLink] = useState<string | null>(null);
	const [showCopySuccess, setShowCopySuccess] = useState(false);

	const handleGenerateRecoveryLink = async () => {
		if (!identity?.id) return;

		setLoading(true);
		setError(null);
		setRecoveryLink(null);

		try {
			const response = await createRecoveryLink(identity.id);

			setRecoveryLink(response.data.recovery_link);
		} catch (err: unknown) {
			console.error("Error generating recovery link:", err);
			const typedErr = err as { response?: { data?: { error?: { message?: string } } } };
			setError(typedErr.response?.data?.error?.message || "Failed to generate recovery link. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const handleCopyToClipboard = async () => {
		if (!recoveryLink) return;

		try {
			await navigator.clipboard.writeText(recoveryLink);
			setShowCopySuccess(true);
			setTimeout(() => setShowCopySuccess(false), 2000);
		} catch (err) {
			console.error("Failed to copy to clipboard:", err);
		}
	};

	const handleClose = () => {
		setRecoveryLink(null);
		setError(null);
		setLoading(false);
		onClose();
	};

	if (!identity) return null;

	const traits = identity.traits as Record<string, unknown>;
	const email = (traits?.email as string) || "N/A";

	return (
		<Dialog open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) handleClose(); }}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						<Icon name="link" />
						Generate Recovery Link
					</DialogTitle>
					<DialogDescription>
						Generate a recovery link for this identity that can be used to reset their password or recover their account.
					</DialogDescription>
				</DialogHeader>

				<div>
					<p>
						<strong>Identity:</strong> {email} ({identity.id.substring(0, 8)}...)
					</p>

					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{loading && (
						<div>
							<Icon name="loading" />
						</div>
					)}

					{recoveryLink && (
						<div>
							<Alert>
								<Icon name="success" />
								<AlertDescription>
									Recovery link generated successfully! The link is valid for a limited time.
								</AlertDescription>
							</Alert>

							<div>
								<Label>Recovery Link</Label>
								<div>
									<textarea
										readOnly
										value={recoveryLink}
										rows={3}
									/>
									<Button
										variant="ghost"
										size="icon"
										onClick={handleCopyToClipboard}
										title="Copy to clipboard"
									>
										<Icon name="copy" />
									</Button>
								</div>
							</div>

							<p>
								Send this link to the user via a secure channel. The link will expire after a short period for security.
							</p>

							{showCopySuccess && (
								<p>
									Recovery link copied to clipboard
								</p>
							)}
						</div>
					)}
				</div>

				<DialogFooter>
					{!recoveryLink && (
						<Button onClick={handleGenerateRecoveryLink} disabled={loading}>
							{loading ? (
								<Icon name="loading" />
							) : (
								<Icon name="link" />
							)}
							Generate Recovery Link
						</Button>
					)}
					<Button variant="outline" onClick={handleClose}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default IdentityRecoveryDialog;
