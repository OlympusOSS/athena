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
	Input,
	Label,
} from "@olympusoss/canvas";
import type { Identity } from "@ory/kratos-client";
import type React from "react";
import { useState } from "react";
import { isDemoIdentity } from "@/lib/demo";
import { useResetIdentityPassword } from "../hooks/useIdentities";

interface IdentityResetPasswordDialogProps {
	open: boolean;
	onClose: () => void;
	identity: Identity | null;
	onSuccess?: () => void;
}

export const IdentityResetPasswordDialog: React.FC<IdentityResetPasswordDialogProps> = ({ open, onClose, identity, onSuccess }) => {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showSuccess, setShowSuccess] = useState(false);
	const resetPasswordMutation = useResetIdentityPassword();

	const handleSubmit = async () => {
		if (!identity?.id) return;

		resetPasswordMutation.mutate(
			{ id: identity.id, password },
			{
				onSuccess: () => {
					setShowSuccess(true);
					setTimeout(() => {
						handleClose();
						onSuccess?.();
					}, 1500);
				},
			},
		);
	};

	const handleClose = () => {
		setPassword("");
		setConfirmPassword("");
		setShowSuccess(false);
		resetPasswordMutation.reset();
		onClose();
	};

	if (!identity) return null;

	const isDemo = isDemoIdentity(identity);
	const traits = identity.traits as Record<string, unknown>;
	const email = (traits?.email as string) || "N/A";

	// Validation
	const passwordTooShort = password.length > 0 && password.length < 12;
	const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
	const canSubmit = password.length >= 12 && password === confirmPassword && !isDemo && !resetPasswordMutation.isPending;

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen: boolean) => {
				if (!isOpen) handleClose();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						<Icon name="key-round" />
						Reset Password
					</DialogTitle>
					<DialogDescription>Set a new password for this identity. The password will take effect immediately.</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						<strong className="text-foreground">Identity:</strong> {email} ({identity.id.substring(0, 8)}…)
					</p>

					{isDemo && (
						<Alert>
							<Icon name="lock" />
							<AlertDescription>Password reset is disabled for demo accounts.</AlertDescription>
						</Alert>
					)}

					{!isDemo && !showSuccess && (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="new-password">New Password</Label>
								<Input
									id="new-password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="At least 12 characters"
									autoComplete="new-password"
									disabled={resetPasswordMutation.isPending}
								/>
								{passwordTooShort && <p className="text-sm text-destructive">Password must be at least 12 characters</p>}
							</div>

							<div className="space-y-2">
								<Label htmlFor="confirm-password">Confirm Password</Label>
								<Input
									id="confirm-password"
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									placeholder="Repeat the password"
									autoComplete="new-password"
									disabled={resetPasswordMutation.isPending}
								/>
								{passwordsMismatch && <p className="text-sm text-destructive">Passwords do not match</p>}
							</div>

							{/* Password strength indicator */}
							<div className="space-y-1">
								<div className="flex gap-1">
									{[12, 16, 20, 24].map((threshold, i) => (
										<div
											key={threshold}
											className={`h-1 flex-1 rounded-full transition-colors ${
												password.length >= threshold ? (i < 2 ? "bg-amber-500" : "bg-green-500") : "bg-muted"
											}`}
										/>
									))}
								</div>
								<p className="text-xs text-muted-foreground">{password.length === 0 ? "Minimum 12 characters" : `${password.length} characters`}</p>
							</div>
						</div>
					)}

					{resetPasswordMutation.isError && (
						<Alert variant="destructive">
							<AlertDescription>Failed to reset password: {(resetPasswordMutation.error as Error)?.message || "Unknown error"}</AlertDescription>
						</Alert>
					)}

					{showSuccess && (
						<Alert>
							<Icon name="success" />
							<AlertDescription>Password has been reset successfully.</AlertDescription>
						</Alert>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose} disabled={resetPasswordMutation.isPending}>
						{showSuccess ? "Close" : "Cancel"}
					</Button>
					{!showSuccess && (
						<Button onClick={handleSubmit} disabled={!canSubmit}>
							{resetPasswordMutation.isPending ? (
								<>
									<Icon name="loading" />
									Resetting…
								</>
							) : (
								<>
									<Icon name="key-round" />
									Reset Password
								</>
							)}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default IdentityResetPasswordDialog;
