import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	ErrorState,
	Icon,
	LoadingState,
	ScrollArea,
	StatusBadge,
} from "@olympusoss/canvas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { formatDate } from "@/lib/date-utils";
import { disableSession, extendSession, getSession } from "../../../services/kratos/endpoints/sessions";

interface SessionDetailDialogProps {
	open: boolean;
	onClose: () => void;
	sessionId: string;
	onSessionUpdated?: () => void;
}

export const SessionDetailDialog: React.FC<SessionDetailDialogProps> = React.memo(({ open, onClose, sessionId, onSessionUpdated }) => {
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const queryClient = useQueryClient();

	// Fetch detailed session information
	const {
		data: sessionData,
		isLoading,
		error: fetchError,
	} = useQuery({
		queryKey: ["session", sessionId],
		queryFn: () => getSession(sessionId, ["identity", "devices"]),
		enabled: open && !!sessionId,
		retry: 2,
	});

	const session = sessionData?.data;

	// Delete session mutation
	const deleteMutation = useMutation({
		mutationFn: () => disableSession(sessionId),
		onSuccess: () => {
			// Call the parent refetch function directly
			onSessionUpdated?.();
			onClose();
		},
		onError: (error: any) => {
			setError(error?.response?.data?.error?.message || "Failed to revoke session");
		},
		onSettled: () => {
			setActionLoading(null);
		},
	});

	// Extend session mutation
	const extendMutation = useMutation({
		mutationFn: () => extendSession(sessionId),
		onSuccess: () => {
			// Invalidate current session details and call parent refetch
			queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			onSessionUpdated?.();
		},
		onError: (error: any) => {
			setError(error?.response?.data?.error?.message || "Failed to extend session");
		},
		onSettled: () => {
			setActionLoading(null);
		},
	});

	const handleRevokeSession = () => {
		setActionLoading("delete");
		setError(null);
		deleteMutation.mutate();
	};

	const handleExtendSession = () => {
		setActionLoading("extend");
		setError(null);
		extendMutation.mutate();
	};

	const getTimeRemaining = (expiresAt: string): string | null => {
		if (!expiresAt) return null;

		const now = new Date();
		const expiry = new Date(expiresAt);
		const diff = expiry.getTime() - now.getTime();

		if (diff <= 0) return "Expired";

		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

		if (days > 0) return `${days}d ${hours}h remaining`;
		if (hours > 0) return `${hours}h ${minutes}m remaining`;
		return `${minutes}m remaining`;
	};

	const getIdentityDisplay = (identity: any): string => {
		if (!identity) return "Unknown";
		const traits = identity.traits;
		if (!traits) return identity.id;
		return traits.email || traits.username || identity.id;
	};

	if (isLoading) {
		return (
			<Dialog open={open} onOpenChange={() => onClose()}>
				<DialogContent>
					<LoadingState variant="section" />
				</DialogContent>
			</Dialog>
		);
	}

	if (fetchError || !session) {
		return (
			<Dialog open={open} onOpenChange={() => onClose()}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Session Details</DialogTitle>
					</DialogHeader>
					<ErrorState variant="inline" message={`Failed to load session details: ${fetchError?.message || "Unknown error"}`} />
				</DialogContent>
			</Dialog>
		);
	}

	const timeRemaining = session.expires_at ? getTimeRemaining(session.expires_at) : null;
	const isExpired = timeRemaining === "Expired";
	const _isExpiringSoon = timeRemaining?.includes("m remaining");

	return (
		<Dialog open={open} onOpenChange={() => onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Session Details</DialogTitle>
				</DialogHeader>

				<ScrollArea>
					<div>
						{error && (
							<div>
								<span>{error}</span>
								<button type="button" onClick={() => setError(null)}>
									<Icon name="close" />
								</button>
							</div>
						)}

						{/* Basic Session Info */}
						<div>
							<div>
								<Icon name="info" />
								<h3>Basic Information</h3>
							</div>

							<div>
								<div>
									<span>Session ID</span>
									<code>{session.id}</code>
								</div>

								<div>
									<span>Status</span>
									<div>
										<StatusBadge status={session.active ? "active" : "inactive"} label={session.active ? "Active" : "Inactive"} showIcon />
									</div>
								</div>

								<div>
									<span>Authenticated At</span>
									<p>{session.authenticated_at ? formatDate(session.authenticated_at) : "N/A"}</p>
								</div>

								<div>
									<span>Issued At</span>
									<p>{session.issued_at ? formatDate(session.issued_at) : "N/A"}</p>
								</div>

								<div>
									<span>Expires At</span>
									<p>{session.expires_at ? formatDate(session.expires_at) : "N/A"}</p>
									{timeRemaining && <span>{timeRemaining}</span>}
								</div>

								<div>
									<span>Assurance Level</span>
									<p>{session.authenticator_assurance_level || "N/A"}</p>
								</div>
							</div>
						</div>

						{/* Identity Information */}
						{session.identity && (
							<div>
								<div>
									<Icon name="user" />
									<h3>Identity Information</h3>
								</div>

								<div>
									<div>
										<span>Identity ID</span>
										<code>{session.identity.id}</code>
									</div>

									<div>
										<span>Display Name</span>
										<p>{getIdentityDisplay(session.identity)}</p>
									</div>

									<div>
										<span>State</span>
										<div>
											<Badge variant="secondary">{session.identity.state}</Badge>
										</div>
									</div>

									<div>
										<span>Schema ID</span>
										<p>{session.identity.schema_id || "N/A"}</p>
									</div>
								</div>

								{session.identity.traits && (
									<Accordion type="single" collapsible>
										<AccordionItem value="traits">
											<AccordionTrigger>
												<span>Identity Traits</span>
											</AccordionTrigger>
											<AccordionContent>
												<pre>{JSON.stringify(session.identity.traits, null, 2)}</pre>
											</AccordionContent>
										</AccordionItem>
									</Accordion>
								)}
							</div>
						)}

						{/* Authentication Methods */}
						{session.authentication_methods && session.authentication_methods.length > 0 && (
							<div>
								<div>
									<Icon name="shield" />
									<h3>Authentication Methods</h3>
								</div>

								<Accordion type="single" collapsible>
									<AccordionItem value="auth-methods">
										<AccordionTrigger>
											<span>{session.authentication_methods.length} method(s) used</span>
										</AccordionTrigger>
										<AccordionContent>
											<pre>{JSON.stringify(session.authentication_methods, null, 2)}</pre>
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							</div>
						)}

						{/* Devices */}
						{session.devices && session.devices.length > 0 && (
							<div>
								<div>
									<Icon name="monitor" />
									<h3>Devices</h3>
								</div>

								<Accordion type="single" collapsible>
									<AccordionItem value="devices">
										<AccordionTrigger>
											<span>{session.devices.length} device(s) registered</span>
										</AccordionTrigger>
										<AccordionContent>
											<pre>{JSON.stringify(session.devices, null, 2)}</pre>
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							</div>
						)}
					</div>
				</ScrollArea>

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Close
					</Button>
					{session.active && !isExpired && (
						<Button variant="outline" onClick={handleExtendSession} disabled={actionLoading === "extend"}>
							{actionLoading === "extend" ? "Extending..." : "Extend Session"}
						</Button>
					)}
					<Button variant="destructive" onClick={handleRevokeSession} disabled={actionLoading === "delete"}>
						{actionLoading === "delete" ? "Revoking..." : "Revoke Session"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
});

SessionDetailDialog.displayName = "SessionDetailDialog";
