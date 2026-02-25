"use client";

import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	Card,
	CardContent,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	FieldDisplay,
	Icon,
	LoadingState,
	Separator,
	StatusBadge,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@olympusoss/canvas";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { github, vs2015 } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { ActionBar, FlexBox, PageHeader, ProtectedPage, SectionCard } from "@/components/layout";
import { UserRole } from "@/features/auth";
import { CredentialDeleteDialog } from "@/features/identities/components/CredentialDeleteDialog";
import { IdentityDeleteDialog } from "@/features/identities/components/IdentityDeleteDialog";
import { IdentityEditModal } from "@/features/identities/components/IdentityEditModal";
import { IdentityRecoveryDialog } from "@/features/identities/components/IdentityRecoveryDialog";
import { useIdentity, usePatchIdentity } from "@/features/identities/hooks";
import { SessionDetailDialog } from "@/features/sessions/components/SessionDetailDialog";
import { SessionsTable } from "@/features/sessions/components/SessionsTable";
import { useDeleteIdentitySessions, useIdentitySessions } from "@/features/sessions/hooks";
import { useDialog } from "@/hooks";
import { formatDate } from "@/lib/date-utils";
import { useTheme } from "@/providers/ThemeProvider";

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

const NON_DELETABLE_CREDENTIALS = new Set(["password", "passkey", "code"]);

export default function IdentityDetailPage() {
	const { theme } = useTheme();
	const params = useParams();
	const router = useRouter();
	const identityId = params.id as string;
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
	const [pendingState, setPendingState] = useState<"active" | "inactive">("active");
	const [credentialToDelete, setCredentialToDelete] = useState<{ type: string; identifier?: string } | null>(null);

	const { isOpen: editModalOpen, open: openEditModal, close: closeEditModal } = useDialog();
	const { isOpen: deleteDialogOpen, open: openDeleteDialog, close: closeDeleteDialog } = useDialog();
	const { isOpen: recoveryDialogOpen, open: openRecoveryDialog, close: closeRecoveryDialog } = useDialog();
	const { isOpen: deleteSessionsDialogOpen, open: openDeleteSessionsDialog, close: closeDeleteSessionsDialog } = useDialog();
	const { isOpen: stateDialogOpen, open: openStateDialog, close: closeStateDialog } = useDialog();

	const { data: identity, isLoading, isError, error: _, refetch } = useIdentity(identityId);
	const patchIdentityMutation = usePatchIdentity();

	// Sessions hooks
	const { data: sessionsData, isLoading: sessionsLoading, error: sessionsError, refetch: refetchSessions } = useIdentitySessions(identityId);
	const deleteSessionsMutation = useDeleteIdentitySessions();

	const handleBack = () => {
		router.push("/identities");
	};

	const handleEdit = () => {
		openEditModal();
	};

	const handleEditSuccess = () => {
		refetch(); // Refresh identity data after successful edit
	};

	const handleDelete = () => {
		openDeleteDialog();
	};

	const handleDeleteSuccess = () => {
		// Navigate back to identities list after successful delete
		router.push("/identities");
	};

	const handleRecover = () => {
		openRecoveryDialog();
	};

	const handleDeleteAllSessions = () => {
		openDeleteSessionsDialog();
	};

	const handleDeleteAllSessionsConfirm = () => {
		deleteSessionsMutation.mutate(identityId, {
			onSuccess: () => {
				closeDeleteSessionsDialog();
			},
		});
	};

	const handleStateToggle = () => {
		const newState = identity?.state === "active" ? "inactive" : "active";
		setPendingState(newState);
		openStateDialog();
	};

	const handleStateToggleConfirm = () => {
		patchIdentityMutation.mutate(
			{ id: identityId, jsonPatch: [{ op: "replace" as const, path: "/state", value: pendingState }] },
			{
				onSuccess: () => {
					closeStateDialog();
					refetch();
				},
			},
		);
	};

	const handleSessionClick = (sessionId: string) => {
		setSelectedSessionId(sessionId);
	};

	const handleSessionDialogClose = () => {
		setSelectedSessionId(null);
	};

	const handleSessionUpdated = () => {
		refetchSessions();
	};

	if (isLoading) {
		return (
			<ProtectedPage requiredRole={UserRole.ADMIN}>
				<LoadingState variant="page" />
			</ProtectedPage>
		);
	}

	if (isError || !identity) {
		return (
			<ProtectedPage requiredRole={UserRole.ADMIN}>
				<div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
					<h1 className="text-2xl font-bold text-foreground">Identity Not Found</h1>
					<p className="text-sm text-muted-foreground">The identity with ID &quot;{identityId}&quot; could not be found.</p>
					<Button onClick={handleBack}>Back to Identities</Button>
				</div>
			</ProtectedPage>
		);
	}

	const traits = identity.traits as Record<string, unknown>;
	const isDark = theme === "dark";

	return (
		<ProtectedPage requiredRole={UserRole.ADMIN}>
			<div className="space-y-6">
				<PageHeader
					title={
						<FlexBox align="center" gap={2}>
							<Button variant="ghost" size="icon" onClick={handleBack} aria-label="Go back">
								<Icon name="arrow-left" />
							</Button>
							<div className="space-y-1">
								<h1 className="text-2xl font-bold text-foreground">Identity Details</h1>
								<code className="text-xs font-mono text-muted-foreground">{identityId}</code>
							</div>
						</FlexBox>
					}
					actions={
						<FlexBox gap={1}>
							<TooltipProvider delayDuration={0}>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Refresh">
											<Icon name="refresh" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Refresh</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<Button variant="outline" onClick={handleEdit}>
								<Icon name="edit" />
								Edit
							</Button>
							<Button variant="outline" onClick={handleRecover}>
								<Icon name="link" />
								Recover
							</Button>
							<Button
								variant={identity.state === "active" ? "outline" : "default"}
								onClick={handleStateToggle}
								disabled={patchIdentityMutation.isPending}
							>
								{identity.state === "active" ? (
									<>
										<Icon name="blocked" />
										Deactivate
									</>
								) : (
									<>
										<Icon name="success" />
										Activate
									</>
								)}
							</Button>
							<Button variant="destructive" onClick={handleDelete}>
								<Icon name="delete" />
								Delete
							</Button>
						</FlexBox>
					}
				/>

				<div className="space-y-6">
					{/* Basic Information */}
					<SectionCard title="Basic Information">
						<div className="space-y-4">
							<div className="grid gap-4">
								<span className="text-sm font-medium text-muted-foreground">Status</span>
								<div className="flex items-center gap-2">
									<StatusBadge status={identity.state === "active" ? "active" : "inactive"} label={identity.state || "active"} />
								</div>
							</div>
							<FieldDisplay label="Schema ID" value={identity.schema_id} valueType="code" copyable />
							<FieldDisplay label="Created At" value={formatDate(identity.created_at || "")} />
							<FieldDisplay label="Updated At" value={formatDate(identity.updated_at || "")} />
						</div>
					</SectionCard>

					{/* Traits */}
					<SectionCard title="Traits" emptyMessage={!traits || Object.keys(traits).length === 0 ? "No traits available" : undefined}>
						{traits && Object.keys(traits).length > 0 && (
							<div className="space-y-4">
								{Object.entries(traits).map(([key, value]) => (
									<FieldDisplay
										key={key}
										label={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ")}
										value={typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
										valueType={typeof value === "object" ? "code" : "text"}
									/>
								))}
							</div>
						)}
					</SectionCard>

					{/* Public Metadata */}
					<Card>
						<CardContent className="space-y-4">
							<h3 className="text-lg font-semibold text-foreground">Public Metadata</h3>
							<Separator />

							{identity.metadata_public && Object.keys(identity.metadata_public).length > 0 ? (
								<div className="overflow-auto rounded-md" style={{ maxHeight: "400px" }}>
									<SyntaxHighlighter
										language="json"
										style={isDark ? vs2015 : github}
										customStyle={{
											margin: 0,
											padding: "1rem",
											fontSize: "0.875rem",
											background: isDark ? "#1e1e1e" : "#f8f9fa",
											borderRadius: "var(--radius)",
											lineHeight: 1.4,
											border: `1px solid ${isDark ? "hsl(var(--border))" : "hsl(var(--border))"}`,
										}}
										showLineNumbers={false}
										wrapLongLines={true}
									>
										{JSON.stringify(identity.metadata_public, null, 2)}
									</SyntaxHighlighter>
								</div>
							) : (
								<p className="text-sm text-muted-foreground">No public metadata available</p>
							)}
						</CardContent>
					</Card>

					{/* Admin Metadata */}
					<Card>
						<CardContent className="space-y-4">
							<h3 className="text-lg font-semibold text-foreground">Admin Metadata</h3>
							<Separator />

							{identity.metadata_admin && Object.keys(identity.metadata_admin).length > 0 ? (
								<div className="overflow-auto rounded-md" style={{ maxHeight: "400px" }}>
									<SyntaxHighlighter
										language="json"
										style={isDark ? vs2015 : github}
										customStyle={{
											margin: 0,
											padding: "1rem",
											fontSize: "0.875rem",
											background: isDark ? "#1e1e1e" : "#f8f9fa",
											borderRadius: "var(--radius)",
											lineHeight: 1.4,
											border: `1px solid ${isDark ? "hsl(var(--border))" : "hsl(var(--border))"}`,
										}}
										showLineNumbers={false}
										wrapLongLines={true}
									>
										{JSON.stringify(identity.metadata_admin, null, 2)}
									</SyntaxHighlighter>
								</div>
							) : (
								<p className="text-sm text-muted-foreground">No admin metadata available</p>
							)}
						</CardContent>
					</Card>

					{/* Credentials Section */}
					<div className="space-y-3">
						<Card>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Icon name="key-round" />
										<h3 className="text-lg font-semibold text-foreground">Credentials</h3>
									</div>
								</div>
								<Separator />

								{identity.credentials && Object.keys(identity.credentials).length > 0 ? (
									<div className="space-y-3">
										{Object.entries(identity.credentials).flatMap(([type, credential]) => {
											const needsIdentifier = type === "oidc" || type === "saml";
											const identifiers = credential.identifiers || [];

											// For OIDC/SAML, render one row per identifier
											if (needsIdentifier && identifiers.length > 0) {
												return identifiers.map((identifier) => (
													<div key={`${type}-${identifier}`} className="flex items-center justify-between rounded-lg border border-border p-3">
														<div className="flex flex-wrap items-center gap-2">
															<Badge variant="secondary">{CREDENTIAL_TYPE_LABELS[type] || type}</Badge>
															<span className="text-sm text-muted-foreground">{identifier}</span>
															{credential.created_at && <span className="text-xs text-muted-foreground">{formatDate(credential.created_at)}</span>}
														</div>
														<TooltipProvider delayDuration={0}>
															<Tooltip>
																<TooltipTrigger asChild>
																	<Button variant="ghost" size="icon" onClick={() => setCredentialToDelete({ type, identifier })}>
																		<Icon name="delete" />
																	</Button>
																</TooltipTrigger>
																<TooltipContent>Delete {CREDENTIAL_TYPE_LABELS[type] || type} credential</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													</div>
												));
											}

											// For other types, render one row per credential
											return [
												<div key={type} className="flex items-center justify-between rounded-lg border border-border p-3">
													<div className="flex flex-wrap items-center gap-2">
														<Badge variant="secondary">{CREDENTIAL_TYPE_LABELS[type] || type}</Badge>
														{identifiers.length > 0 && <span className="text-sm text-muted-foreground">{identifiers.join(", ")}</span>}
														{credential.created_at && <span className="text-xs text-muted-foreground">{formatDate(credential.created_at)}</span>}
													</div>
													{NON_DELETABLE_CREDENTIALS.has(type) ? (
														<TooltipProvider delayDuration={0}>
															<Tooltip>
																<TooltipTrigger asChild>
																	<span className="text-sm text-muted-foreground">
																		<Icon name="lock" />
																	</span>
																</TooltipTrigger>
																<TooltipContent>Cannot be deleted via API</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													) : (
														<TooltipProvider delayDuration={0}>
															<Tooltip>
																<TooltipTrigger asChild>
																	<Button variant="ghost" size="icon" onClick={() => setCredentialToDelete({ type })}>
																		<Icon name="delete" />
																	</Button>
																</TooltipTrigger>
																<TooltipContent>Delete {CREDENTIAL_TYPE_LABELS[type] || type} credential</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													)}
												</div>,
											];
										})}
									</div>
								) : (
									<div className="py-6 text-center">
										<p className="text-sm text-muted-foreground">No credentials found for this identity</p>
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Sessions Section */}
					<div className="space-y-3">
						<Card>
							<CardContent className="space-y-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Icon name="user" />
										<h3 className="text-lg font-semibold text-foreground">Sessions</h3>
									</div>
									<div className="flex items-center gap-2">
										<TooltipProvider delayDuration={0}>
											<Tooltip>
												<TooltipTrigger asChild>
													<Button variant="ghost" size="icon" onClick={() => refetchSessions()}>
														<Icon name="refresh" />
													</Button>
												</TooltipTrigger>
												<TooltipContent>Refresh Sessions</TooltipContent>
											</Tooltip>
										</TooltipProvider>
										<Button
											variant="destructive"
											size="sm"
											onClick={handleDeleteAllSessions}
											disabled={deleteSessionsMutation.isPending || sessionsLoading || !sessionsData?.data?.length}
										>
											<Icon name="delete" />
											Delete All Sessions
										</Button>
									</div>
								</div>
								<Separator />

								{sessionsError ? (
									<Alert variant="destructive">
										<AlertDescription>Failed to load sessions: {sessionsError.message}</AlertDescription>
									</Alert>
								) : sessionsLoading ? (
									<div className="flex items-center justify-center py-8">
										<Icon name="loading" />
									</div>
								) : !sessionsData?.data?.length ? (
									<div className="py-6 text-center">
										<p className="text-sm text-muted-foreground">No active sessions found for this identity</p>
									</div>
								) : (
									<>
										<SessionsTable
											key={sessionsData.headers?.etag || "identity-sessions"}
											sessions={sessionsData.data}
											isLoading={false}
											isFetchingNextPage={false}
											searchQuery=""
											onSessionClick={handleSessionClick}
										/>
										<div className="py-2 text-center">
											<p className="text-sm text-muted-foreground">Showing {sessionsData.data.length} session(s) for this identity</p>
										</div>
									</>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Raw JSON */}
					<div className="space-y-3">
						<Card>
							<CardContent className="space-y-4">
								<h3 className="text-lg font-semibold text-foreground">Raw Data</h3>
								<Separator />
								<div className="overflow-auto rounded-md" style={{ maxHeight: "60vh" }}>
									<SyntaxHighlighter
										language="json"
										style={isDark ? vs2015 : github}
										customStyle={{
											margin: 0,
											padding: "1.5rem",
											fontSize: "0.875rem",
											background: isDark ? "#1e1e1e" : "#f8f9fa",
											borderRadius: "var(--radius)",
											lineHeight: 1.5,
											border: `1px solid hsl(var(--border))`,
										}}
										showLineNumbers={true}
										lineNumberStyle={{
											color: isDark ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground))",
											paddingRight: "1rem",
											minWidth: "2rem",
											userSelect: "none",
										}}
										wrapLongLines={true}
									>
										{JSON.stringify(identity, null, 2)}
									</SyntaxHighlighter>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>

				{/* Edit Modal */}
				<IdentityEditModal open={editModalOpen} onClose={closeEditModal} identity={identity} onSuccess={handleEditSuccess} />

				{/* Recovery Dialog */}
				<IdentityRecoveryDialog open={recoveryDialogOpen} onClose={closeRecoveryDialog} identity={identity} />

				{/* Delete Dialog */}
				<IdentityDeleteDialog open={deleteDialogOpen} onClose={closeDeleteDialog} identity={identity} onSuccess={handleDeleteSuccess} />

				{/* Credential Delete Dialog */}
				{credentialToDelete && (
					<CredentialDeleteDialog
						open={true}
						onClose={() => setCredentialToDelete(null)}
						identityId={identityId}
						credentialType={credentialToDelete.type}
						identifier={credentialToDelete.identifier}
						onSuccess={() => refetch()}
					/>
				)}

				{/* Delete All Sessions Dialog */}
				<Dialog open={deleteSessionsDialogOpen} onOpenChange={(open) => !open && closeDeleteSessionsDialog()}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Delete All Sessions</DialogTitle>
							<DialogDescription>
								This action will revoke all active sessions for this identity. The user will be logged out from all devices.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							<Alert>
								<AlertDescription>
									This action will revoke all active sessions for this identity. The user will be logged out from all devices.
								</AlertDescription>
							</Alert>
							<p className="text-sm text-muted-foreground">
								Are you sure you want to delete all sessions for this identity? This action cannot be undone.
							</p>
							{deleteSessionsMutation.error && (
								<Alert variant="destructive">
									<AlertDescription>Failed to delete sessions: {deleteSessionsMutation.error.message}</AlertDescription>
								</Alert>
							)}
						</div>
						<DialogFooter>
							<ActionBar
								align="right"
								primaryAction={{
									label: deleteSessionsMutation.isPending ? "Deleting..." : "Delete All Sessions",
									onClick: handleDeleteAllSessionsConfirm,
									disabled: deleteSessionsMutation.isPending,
								}}
								secondaryActions={[
									{
										label: "Cancel",
										onClick: closeDeleteSessionsDialog,
									},
								]}
							/>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* State Toggle Confirmation Dialog */}
				<Dialog open={stateDialogOpen} onOpenChange={(open) => !open && closeStateDialog()}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>{pendingState === "active" ? "Activate Identity" : "Deactivate Identity"}</DialogTitle>
							<DialogDescription>
								{pendingState === "inactive"
									? "Deactivating this identity will prevent the user from signing in."
									: "Activating this identity will allow the user to sign in again."}
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							<Alert>
								<AlertDescription>
									{pendingState === "inactive"
										? "Deactivating this identity will prevent the user from signing in. All active sessions will remain until they expire."
										: "Activating this identity will allow the user to sign in again."}
								</AlertDescription>
							</Alert>
							<p className="text-sm text-muted-foreground">
								Are you sure you want to {pendingState === "active" ? "activate" : "deactivate"} this identity?
							</p>
							{patchIdentityMutation.error && (
								<Alert variant="destructive">
									<AlertDescription>Failed to update identity state: {patchIdentityMutation.error.message}</AlertDescription>
								</Alert>
							)}
						</div>
						<DialogFooter>
							<ActionBar
								align="right"
								primaryAction={{
									label: patchIdentityMutation.isPending ? "Updating..." : pendingState === "active" ? "Activate" : "Deactivate",
									onClick: handleStateToggleConfirm,
									disabled: patchIdentityMutation.isPending,
								}}
								secondaryActions={[
									{
										label: "Cancel",
										onClick: closeStateDialog,
									},
								]}
							/>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Session Detail Dialog */}
				{selectedSessionId && (
					<SessionDetailDialog open={true} onClose={handleSessionDialogClose} sessionId={selectedSessionId} onSessionUpdated={handleSessionUpdated} />
				)}
			</div>
		</ProtectedPage>
	);
}
