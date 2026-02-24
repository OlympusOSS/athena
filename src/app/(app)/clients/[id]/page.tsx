"use client";

import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	ErrorState,
	Icon,
	LoadingState,
	StatusBadge,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@olympus/canvas";
import { useRouter } from "next/navigation";
import { use, useMemo, useRef, useState } from "react";
import { ActionBar, ProtectedPage } from "@/components/layout";
import {
	getClientType,
	getGrantTypeDisplayName,
	getResponseTypeDisplayName,
	useDeleteOAuth2Client,
	useOAuth2Client,
} from "@/features/oauth2-clients";
import { useCopyToClipboard, useDialog, useFormatters } from "@/hooks";

interface Props {
	params: Promise<{ id: string }>;
}

export default function OAuth2ClientDetailPage({ params }: Props) {
	const resolvedParams = use(params);
	const router = useRouter();
	const [menuOpen, setMenuOpen] = useState(false);
	const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
	const menuButtonRef = useRef<HTMLButtonElement>(null);
	const { copy, copiedField } = useCopyToClipboard();
	const { isOpen: deleteDialogOpen, open: openDeleteDialog, close: closeDeleteDialog } = useDialog();
	const { formatDateTime } = useFormatters();

	const { data: clientResponse, isLoading, error } = useOAuth2Client(resolvedParams.id);
	const deleteClientMutation = useDeleteOAuth2Client();

	const client = clientResponse?.data;
	const clientType = useMemo(() => (client ? getClientType(client) : null), [client]);

	const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		setMenuPosition({ top: rect.bottom + 4, left: rect.left - 120 });
		setMenuOpen(true);
	};

	const handleMenuClose = () => {
		setMenuOpen(false);
		setMenuPosition(null);
	};

	const handleEdit = () => {
		router.push(`/clients/${resolvedParams.id}/edit`);
		handleMenuClose();
	};

	const handleDeleteClick = () => {
		openDeleteDialog();
		handleMenuClose();
	};

	const handleDeleteConfirm = async () => {
		try {
			await deleteClientMutation.mutateAsync(resolvedParams.id);
			router.push("/clients");
		} catch (error) {
			console.error("Failed to delete client:", error);
		}
	};

	const copyToClipboard = async (text: string, fieldName: string) => {
		await copy(text, fieldName);
	};

	const formatTimestamp = (timestamp?: string) => {
		if (!timestamp) return "Unknown";
		return formatDateTime(timestamp);
	};

	if (error) {
		return (
			<ProtectedPage>
				<div className="space-y-6">
					<ErrorState message={`Failed to load client: ${error.message}`} variant="page" />
				</div>
			</ProtectedPage>
		);
	}

	return (
		<ProtectedPage>
			<div className="space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
							<Icon name="arrow-left" />
						</Button>
						<Icon name="grid" />
						<div className="space-y-1">
							{isLoading ? (
								<LoadingState variant="inline" />
							) : (
								<>
									<h1 className="text-2xl font-bold text-foreground">{client?.client_name || "Unnamed Client"}</h1>
									<div className="flex items-center gap-2">
										<code className="text-xs font-mono text-muted-foreground">{client?.client_id}</code>
										{client?.client_id && (
											<TooltipProvider delayDuration={0}>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="icon"
															onClick={() => copyToClipboard(client.client_id!, "client_id")}
															aria-label="Copy client ID"
														>
															<Icon name="copy" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>{copiedField === "client_id" ? "Copied!" : "Copy Client ID"}</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										)}
										{clientType && <StatusBadge status={clientType.toLowerCase() === "public" ? "active" : "inactive"} label={clientType} />}
									</div>
								</>
							)}
						</div>
					</div>

					{!isLoading && client && (
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={handleEdit}>
								<Icon name="edit" />
								Edit
							</Button>
							<Button ref={menuButtonRef} variant="ghost" size="icon" onClick={handleMenuClick} aria-label="More options">
								<Icon name="more-vertical" />
							</Button>
						</div>
					)}
				</div>

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
					{/* Main content: 2/3 width */}
					<div className="space-y-6 lg:col-span-2">
						{/* Basic Information */}
						<Card>
							<CardHeader>
								<CardTitle>Basic Information</CardTitle>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="space-y-4">
										<div className="h-4 w-full animate-pulse rounded bg-muted" />
										<div className="h-4 w-full animate-pulse rounded bg-muted" />
										<div className="h-4 w-full animate-pulse rounded bg-muted" />
									</div>
								) : (
									<div className="space-y-4">
										<div className="space-y-1">
											<p className="text-sm font-medium text-muted-foreground">Client Name</p>
											<p className="text-sm text-foreground">{client?.client_name || "Not specified"}</p>
										</div>
										<div className="space-y-1">
											<p className="text-sm font-medium text-muted-foreground">Owner</p>
											<p className="text-sm text-foreground">{client?.owner || "Not specified"}</p>
										</div>
										<div className="space-y-1">
											<p className="text-sm font-medium text-muted-foreground">Client URI</p>
											<p className="text-sm text-foreground">
												{client?.client_uri ? (
													<a className="text-sm text-primary hover:underline" href={client.client_uri} target="_blank" rel="noopener noreferrer">
														{client.client_uri}
													</a>
												) : (
													"Not specified"
												)}
											</p>
										</div>
										<div className="space-y-1">
											<p className="text-sm font-medium text-muted-foreground">Logo URI</p>
											<p className="text-sm text-foreground">
												{client?.logo_uri ? (
													<a className="text-sm text-primary hover:underline" href={client.logo_uri} target="_blank" rel="noopener noreferrer">
														{client.logo_uri}
													</a>
												) : (
													"Not specified"
												)}
											</p>
										</div>
									</div>
								)}
							</CardContent>
						</Card>

						{/* OAuth2 Configuration */}
						<Card>
							<CardHeader>
								<CardTitle>OAuth2 Configuration</CardTitle>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="space-y-4">
										<div className="h-4 w-full animate-pulse rounded bg-muted" />
										<div className="h-4 w-full animate-pulse rounded bg-muted" />
										<div className="h-4 w-full animate-pulse rounded bg-muted" />
									</div>
								) : (
									<div className="space-y-4">
										<div className="space-y-1">
											<p className="text-sm font-medium text-muted-foreground">Grant Types</p>
											<div className="flex flex-wrap gap-1">
												{client?.grant_types?.map((grantType) => (
													<Badge key={grantType} variant="outline">
														{getGrantTypeDisplayName(grantType)}
													</Badge>
												)) || <span className="text-sm text-muted-foreground">None specified</span>}
											</div>
										</div>
										<div className="space-y-1">
											<p className="text-sm font-medium text-muted-foreground">Response Types</p>
											<div className="flex flex-wrap gap-1">
												{client?.response_types?.map((responseType) => (
													<Badge key={responseType} variant="secondary">
														{getResponseTypeDisplayName(responseType)}
													</Badge>
												)) || <span className="text-sm text-muted-foreground">None specified</span>}
											</div>
										</div>
										<div className="space-y-1">
											<p className="text-sm font-medium text-muted-foreground">Scopes</p>
											<div className="flex flex-wrap gap-1">
												{client?.scope ? (
													client.scope
														.split(" ")
														.filter((s) => s.trim())
														.map((scope) => (
															<Badge key={scope} variant="outline">
																{scope}
															</Badge>
														))
												) : (
													<span className="text-sm text-muted-foreground">None specified</span>
												)}
											</div>
										</div>
									</div>
								)}
							</CardContent>
						</Card>

						{/* Redirect URIs */}
						<Card>
							<CardHeader>
								<CardTitle>Redirect URIs</CardTitle>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="h-4 w-full animate-pulse rounded bg-muted" />
								) : client?.redirect_uris?.length ? (
									<ul className="space-y-2">
										{client.redirect_uris.map((uri, index) => (
											<li key={index} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
												<code className="flex-1 font-mono text-sm text-foreground">{uri}</code>
												<TooltipProvider delayDuration={0}>
													<Tooltip>
														<TooltipTrigger asChild>
															<Button variant="ghost" size="icon" onClick={() => copyToClipboard(uri, `redirect_${index}`)}>
																<Icon name="copy" />
															</Button>
														</TooltipTrigger>
														<TooltipContent>{copiedField === `redirect_${index}` ? "Copied!" : "Copy URI"}</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											</li>
										))}
									</ul>
								) : (
									<p className="text-sm text-muted-foreground">No redirect URIs configured</p>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Sidebar: 1/3 width */}
					<div className="space-y-6">
						{/* Client Credentials */}
						{client?.client_secret && (
							<Card>
								<CardHeader>
									<CardTitle>
										<Icon name="shield-check" />
										Client Credentials
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										<div className="space-y-1">
											<p className="text-sm font-medium text-muted-foreground">Client ID</p>
											<div className="flex items-center gap-2">
												<code className="rounded bg-muted px-2 py-1 font-mono text-sm">{client.client_id}</code>
												<TooltipProvider delayDuration={0}>
													<Tooltip>
														<TooltipTrigger asChild>
															<Button variant="ghost" size="icon" onClick={() => copyToClipboard(client.client_id!, "client_id_sidebar")}>
																<Icon name="copy" />
															</Button>
														</TooltipTrigger>
														<TooltipContent>{copiedField === "client_id_sidebar" ? "Copied!" : "Copy"}</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											</div>
										</div>
										<div className="space-y-1">
											<p className="text-sm font-medium text-muted-foreground">Client Secret</p>
											<div className="flex items-center gap-2">
												<span className="font-mono text-sm text-muted-foreground">{"*".repeat(32)}</span>
												<TooltipProvider delayDuration={0}>
													<Tooltip>
														<TooltipTrigger asChild>
															<Button variant="ghost" size="icon" disabled>
																<Icon name="copy" />
															</Button>
														</TooltipTrigger>
														<TooltipContent>Client secret is hidden for security</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											</div>
											<p className="text-xs text-muted-foreground">Secret cannot be displayed for security reasons</p>
										</div>
									</div>
								</CardContent>
							</Card>
						)}

						{/* Advanced Settings */}
						<Card>
							<CardHeader>
								<CardTitle>Advanced Settings</CardTitle>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="h-4 w-full animate-pulse rounded bg-muted" />
								) : (
									<div className="space-y-4">
										<div className="space-y-1">
											<p className="text-sm font-medium text-muted-foreground">Subject Type</p>
											<p className="text-sm text-foreground">{client?.subject_type || "public"}</p>
										</div>
										<div className="space-y-1">
											<p className="text-sm font-medium text-muted-foreground">Token Endpoint Auth Method</p>
											<p className="text-sm text-foreground">{client?.token_endpoint_auth_method || "client_secret_basic"}</p>
										</div>
										{client?.userinfo_signed_response_alg && (
											<div className="space-y-1">
												<p className="text-sm font-medium text-muted-foreground">UserInfo Signed Response Algorithm</p>
												<p className="text-sm text-foreground">{client.userinfo_signed_response_alg}</p>
											</div>
										)}
									</div>
								)}
							</CardContent>
						</Card>

						{/* Metadata */}
						<Card>
							<CardHeader>
								<CardTitle>Metadata</CardTitle>
							</CardHeader>
							<CardContent>
								{isLoading ? (
									<div className="h-4 w-full animate-pulse rounded bg-muted" />
								) : (
									<div className="space-y-4">
										<div className="space-y-1">
											<p className="text-sm font-medium text-muted-foreground">Created</p>
											<p className="text-sm text-foreground">{formatTimestamp(client?.created_at)}</p>
										</div>
										<div className="space-y-1">
											<p className="text-sm font-medium text-muted-foreground">Last Updated</p>
											<p className="text-sm text-foreground">{formatTimestamp(client?.updated_at)}</p>
										</div>
										{client?.audience?.length ? (
											<div className="space-y-1">
												<p className="text-sm font-medium text-muted-foreground">Audience</p>
												<div className="flex flex-wrap gap-1">
													{client.audience.map((aud, index) => (
														<Badge key={index} variant="outline">
															{aud}
														</Badge>
													))}
												</div>
											</div>
										) : null}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>

				{/* Context Menu (dropdown) */}
				{menuOpen && menuPosition && (
					<>
						<div className="fixed inset-0 z-40" onClick={handleMenuClose} />
						<div
							className="fixed z-50 min-w-[160px] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md"
							style={{ top: menuPosition.top, left: menuPosition.left }}
						>
							<button
								type="button"
								className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent"
								onClick={handleEdit}
							>
								<Icon name="edit" />
								Edit Client
							</button>
							<button
								type="button"
								className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
								onClick={handleDeleteClick}
							>
								<Icon name="delete" />
								Delete Client
							</button>
						</div>
					</>
				)}

				{/* Delete Confirmation Dialog */}
				<Dialog open={deleteDialogOpen} onOpenChange={(open) => !open && closeDeleteDialog()}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Delete OAuth2 Client</DialogTitle>
							<DialogDescription>
								Are you sure you want to delete the client &quot;
								{client?.client_name || client?.client_id}&quot;? This action cannot be undone and will invalidate all tokens issued to this client.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<ActionBar
								align="right"
								primaryAction={{
									label: deleteClientMutation.isPending ? "Deleting..." : "Delete",
									onClick: handleDeleteConfirm,
									disabled: deleteClientMutation.isPending,
								}}
								secondaryActions={[
									{
										label: "Cancel",
										onClick: closeDeleteDialog,
									},
								]}
							/>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Error Display */}
				{deleteClientMutation.error && (
					<div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
						Failed to delete client: {deleteClientMutation.error.message}
					</div>
				)}
			</div>
		</ProtectedPage>
	);
}
