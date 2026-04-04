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
	DialogHeader,
	DialogTitle,
	Icon,
	Switch,
	Toast,
	Toaster,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
	useToast,
} from "@olympusoss/canvas";
import { useState } from "react";
import { AdminLayout, PageHeader } from "@/components/layout";
import { UserRole } from "@/features/auth";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { useSocialConnections, useToggleSocialConnection } from "@/hooks/useSocialConnections";
import type { SocialConnectionAdminView } from "@/lib/social-connections/serializers";
import { DeleteConnectionDialog } from "./components/DeleteConnectionDialog";
import { SocialConnectionForm } from "./components/SocialConnectionForm";

type FormMode = "create" | "edit";

export default function SocialConnectionsPage() {
	const { toast, show: showToast, dismiss } = useToast();

	const { data, isLoading, isError, error, refetch, isFetching } = useSocialConnections();
	const toggleMutation = useToggleSocialConnection();

	const [formOpen, setFormOpen] = useState(false);
	const [formMode, setFormMode] = useState<FormMode>("create");
	const [editingConnection, setEditingConnection] = useState<SocialConnectionAdminView | null>(null);

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deletingProvider, setDeletingProvider] = useState<string | null>(null);

	const connections = data?.connections ?? [];

	const handleAddConnection = () => {
		setFormMode("create");
		setEditingConnection(null);
		setFormOpen(true);
	};

	const handleEditConnection = (connection: SocialConnectionAdminView) => {
		setFormMode("edit");
		setEditingConnection(connection);
		setFormOpen(true);
	};

	const handleDeleteConnection = (provider: string) => {
		setDeletingProvider(provider);
		setDeleteDialogOpen(true);
	};

	const handleToggle = (connection: SocialConnectionAdminView) => {
		toggleMutation.mutate(
			{ provider: connection.provider, enabled: !connection.enabled },
			{
				onSuccess: (result) => {
					const label = result.enabled ? "enabled" : "disabled";
					if (result.reloadStatus === "reloaded") {
						showToast(`Google ${label} and configuration applied.`, "success");
					} else if (result.reloadStatus === "skipped") {
						showToast(`Google ${label}. A Kratos restart is required to apply the change.`, "default");
					} else if (result.reloadStatus === "auth_failed") {
						showToast("Reload authentication failed. Check CIAM_RELOAD_API_KEY configuration.", "destructive");
					} else {
						showToast(
							`Google ${label}. Configuration saved, but automatic reload failed. Changes will take effect after the next Kratos restart.`,
							"default",
						);
					}
				},
				onError: (err) => {
					showToast(err.message || "Failed to toggle connection.", "destructive");
				},
			},
		);
	};

	const handleFormSuccess = (reloadStatus: string, secretChanged: boolean) => {
		setFormOpen(false);
		if (secretChanged) {
			showToast(
				"Saving a new client secret requires a Kratos service restart to take effect (~15-30s). Contact your platform administrator or use octl.",
				"default",
			);
		} else if (reloadStatus === "reloaded") {
			showToast("Configuration applied successfully.", "success");
		} else if (reloadStatus === "auth_failed") {
			showToast("Reload authentication failed. Check CIAM_RELOAD_API_KEY configuration.", "destructive");
		} else if (reloadStatus === "misconfigured") {
			showToast("Configuration saved. CIAM_RELOAD_SIDECAR_URL is not configured — changes require a Kratos restart.", "default");
		} else {
			showToast("Configuration saved, but automatic reload failed. Changes will take effect after the next Kratos restart.", "default");
		}
	};

	const handleDeleteSuccess = (reloadStatus: string) => {
		setDeleteDialogOpen(false);
		setDeletingProvider(null);
		if (reloadStatus === "reloaded") {
			showToast("Social connection removed and configuration applied.", "success");
		} else {
			showToast(
				"Social connection removed. Configuration saved, but automatic reload failed. Changes will take effect after the next Kratos restart.",
				"default",
			);
		}
	};

	return (
		<ProtectedRoute requiredRole={UserRole.ADMIN}>
			<AdminLayout>
				<div className="space-y-6">
					<PageHeader
						title="Social Connections"
						subtitle="Configure OAuth2 social login providers for the CIAM platform"
						icon={<Icon name="app" />}
						actions={
							<TooltipProvider delayDuration={0}>
								<div className="flex items-center gap-2">
									<Tooltip>
										<TooltipTrigger asChild>
											<Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching}>
												<Icon name={isFetching ? "loading" : "refresh"} className={isFetching ? "animate-spin" : undefined} />
											</Button>
										</TooltipTrigger>
										<TooltipContent>Refresh</TooltipContent>
									</Tooltip>
									<Button onClick={handleAddConnection}>
										<Icon name="add" className="h-4 w-4" />
										Add Connection
									</Button>
								</div>
							</TooltipProvider>
						}
					/>

					{isError && (
						<Card>
							<CardContent className="pt-6">
								<div className="flex flex-col items-center gap-4 py-10 text-center">
									<Icon name="danger" className="h-8 w-8 text-destructive" />
									<p className="text-sm text-muted-foreground">{error?.message ?? "Failed to load social connections. Please try again."}</p>
									<Button variant="outline" onClick={() => refetch()}>
										<Icon name="refresh" className="h-4 w-4" />
										Retry
									</Button>
								</div>
							</CardContent>
						</Card>
					)}

					{!isError && !isLoading && connections.length === 0 && (
						<Card>
							<CardContent className="pt-6">
								<div className="flex flex-col items-center gap-4 py-16 text-center">
									<div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
										<Icon name="app" className="h-8 w-8 text-muted-foreground" />
									</div>
									<div className="space-y-2">
										<h3 className="text-lg font-medium">No social connections configured</h3>
										<p className="text-sm text-muted-foreground max-w-sm">
											Add a social login provider to allow users to sign in with their Google, GitHub, or other OAuth2 accounts.
										</p>
									</div>
									<Button onClick={handleAddConnection}>
										<Icon name="add" className="h-4 w-4" />
										Add Connection
									</Button>
								</div>
							</CardContent>
						</Card>
					)}

					{!isError && (isLoading || connections.length > 0) && (
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="text-base">Configured Providers</CardTitle>
									{!isLoading && (
										<Badge variant="secondary">
											{connections.length} {connections.length === 1 ? "provider" : "providers"}
										</Badge>
									)}
								</div>
							</CardHeader>
							<CardContent className="pt-0">
								{isLoading ? (
									<div className="flex items-center justify-center py-10">
										<Icon name="loading" className="h-6 w-6 animate-spin text-muted-foreground" />
									</div>
								) : (
									<div className="divide-y">
										{connections.map((connection) => (
											<SocialConnectionRow
												key={connection.provider}
												connection={connection}
												onEdit={() => handleEditConnection(connection)}
												onDelete={() => handleDeleteConnection(connection.provider)}
												onToggle={() => handleToggle(connection)}
												isToggling={toggleMutation.isPending}
											/>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					)}
				</div>

				{/* Add/Edit Dialog */}
				<Dialog open={formOpen} onOpenChange={setFormOpen}>
					<DialogContent className="max-w-2xl">
						<DialogHeader>
							<DialogTitle>{formMode === "create" ? "Add Social Connection" : `Edit ${editingConnection?.display_name ?? "Connection"}`}</DialogTitle>
						</DialogHeader>
						<SocialConnectionForm
							mode={formMode}
							existingConnection={editingConnection}
							onSuccess={handleFormSuccess}
							onCancel={() => setFormOpen(false)}
						/>
					</DialogContent>
				</Dialog>

				{/* Delete Confirmation Dialog */}
				{deletingProvider && (
					<DeleteConnectionDialog
						open={deleteDialogOpen}
						provider={deletingProvider}
						onSuccess={handleDeleteSuccess}
						onCancel={() => {
							setDeleteDialogOpen(false);
							setDeletingProvider(null);
						}}
					/>
				)}

				<Toaster>
					<Toast {...toast} onClose={dismiss} />
				</Toaster>
			</AdminLayout>
		</ProtectedRoute>
	);
}

interface SocialConnectionRowProps {
	connection: SocialConnectionAdminView;
	onEdit: () => void;
	onDelete: () => void;
	onToggle: () => void;
	isToggling: boolean;
}

function SocialConnectionRow({ connection, onEdit, onDelete, onToggle, isToggling }: SocialConnectionRowProps) {
	return (
		<div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
			<div className="flex items-center gap-4">
				<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
					<Icon name="app" className="h-5 w-5 text-muted-foreground" />
				</div>
				<div>
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium">{connection.display_name}</span>
						<Badge variant={connection.enabled ? "default" : "secondary"}>{connection.enabled ? "Enabled" : "Disabled"}</Badge>
					</div>
					<p className="text-xs text-muted-foreground">Client ID: {connection.client_id}</p>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<TooltipProvider delayDuration={0}>
					<Tooltip>
						<TooltipTrigger asChild>
							<div>
								<Switch
									checked={connection.enabled}
									onCheckedChange={onToggle}
									disabled={isToggling}
									aria-label={`${connection.enabled ? "Disable" : "Enable"} ${connection.display_name}`}
								/>
							</div>
						</TooltipTrigger>
						<TooltipContent>{connection.enabled ? "Disable" : "Enable"} provider</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<Button variant="ghost" size="icon" onClick={onEdit}>
					<Icon name="edit" className="h-4 w-4" />
				</Button>
				<Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive hover:text-destructive">
					<Icon name="delete" className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
