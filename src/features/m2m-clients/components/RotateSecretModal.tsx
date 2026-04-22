"use client";

/**
 * RotateSecretModal — Confirmation before rotating a client secret.
 *
 * Shows a blocking confirmation that explains the old secret will be immediately
 * invalidated. After confirmation, delegates to the rotation API and then shows
 * the SecretRevealModal for one-time display of the new secret.
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

interface RotateSecretModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<void>;
	clientName?: string;
	clientId: string;
	isRotating?: boolean;
	error?: Error | null;
}

export function RotateSecretModal({ open, onOpenChange, onConfirm, clientName, clientId, isRotating = false, error }: RotateSecretModalProps) {
	const displayName = clientName || clientId;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						<Icon name="RefreshCw" />
						Rotate Client Secret
					</DialogTitle>
					<DialogDescription>
						Generate a new secret for <strong>&quot;{displayName}&quot;</strong>.
					</DialogDescription>
				</DialogHeader>

				<Alert>
					<AlertDescription>
						<Icon name="TriangleAlert" />
						<strong>This will immediately invalidate the current secret.</strong> Any agent currently using the old secret will return 401 until
						reconfigured with the new secret.
					</AlertDescription>
				</Alert>

				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRotating}>
						Cancel
					</Button>
					<Button onClick={onConfirm} disabled={isRotating}>
						{isRotating ? (
							<>
								<Icon name="LoaderCircle" />
								Rotating...
							</>
						) : (
							<>
								<Icon name="RefreshCw" />
								Rotate Secret
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
