"use client";

import type { DataTableColumn } from "@olympus/canvas";
import {
	Badge,
	Button,
	Card,
	DataTable,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	EmptyState,
	ErrorState,
	Icon,
	SearchBar,
	StatCard,
} from "@olympus/canvas";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActionBar, PageHeader, ProtectedPage, SectionCard } from "@/components/layout";
import { formatClientId, getClientType, transformOAuth2ClientForTable, useAllOAuth2Clients, useDeleteOAuth2Client } from "@/features/oauth2-clients";
import { useHydraEnabled } from "@/features/settings/hooks/useSettings";
import { useDialog } from "@/hooks";
import type { OAuth2Client } from "@/services/hydra";

export default function OAuth2ClientsPage() {
	const router = useRouter();
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedClient, setSelectedClient] = useState<string | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
	const [clientToDelete, setClientToDelete] = useState<string | null>(null);
	const { isOpen: deleteDialogOpen, open: openDeleteDialog, close: closeDeleteDialog } = useDialog();
	const menuRef = useRef<HTMLDivElement>(null);

	// Check if Hydra is enabled
	const hydraEnabled = useHydraEnabled();

	// Hooks
	const { data: clientsData, isLoading, error } = useAllOAuth2Clients();
	const deleteClientMutation = useDeleteOAuth2Client();

	// Transform data for display
	const clients = useMemo(() => clientsData?.clients || [], [clientsData]);
	const tableRows = useMemo(() => clients.map(transformOAuth2ClientForTable), [clients]);

	// Filter clients based on search
	const filteredRows = useMemo(
		() =>
			tableRows.filter(
				(row) =>
					row.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
					row.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
					row.owner?.toLowerCase().includes(searchTerm.toLowerCase()),
			),
		[tableRows, searchTerm],
	);

	// Handle menu actions
	const handleMenuClick = useCallback((event: React.MouseEvent<HTMLElement>, clientId: string) => {
		event.stopPropagation();
		const rect = event.currentTarget.getBoundingClientRect();
		setSelectedClient(clientId);
		setMenuPosition({ top: rect.bottom + 4, left: rect.left - 120 });
		setMenuOpen(true);
	}, []);

	const handleMenuClose = useCallback(() => {
		setMenuOpen(false);
		setSelectedClient(null);
		setMenuPosition(null);
	}, []);

	const handleView = useCallback(
		(clientId: string) => {
			router.push(`/clients/${clientId}`);
			handleMenuClose();
		},
		[router, handleMenuClose],
	);

	const handleEdit = useCallback(
		(clientId: string) => {
			router.push(`/clients/${clientId}/edit`);
			handleMenuClose();
		},
		[router, handleMenuClose],
	);

	const handleDeleteClick = useCallback(
		(clientId: string) => {
			setClientToDelete(clientId);
			openDeleteDialog();
			handleMenuClose();
		},
		[openDeleteDialog, handleMenuClose],
	);

	const handleDeleteConfirm = async () => {
		if (!clientToDelete) return;

		try {
			await deleteClientMutation.mutateAsync(clientToDelete);
			closeDeleteDialog();
			setClientToDelete(null);
		} catch (error) {
			console.error("Failed to delete client:", error);
		}
	};

	const handleDeleteCancel = () => {
		closeDeleteDialog();
		setClientToDelete(null);
	};

	// Table columns
	const columns: DataTableColumn[] = [
		{
			field: "displayName",
			headerName: "Client Name",
			flex: 1,
			minWidth: 200,
			renderCell: (value: string, row: any) => (
				<div className="space-y-0.5">
					<span className="font-medium text-foreground">{value}</span>
					<br />
					<code className="text-xs font-mono text-muted-foreground">{formatClientId(row.id)}</code>
				</div>
			),
		},
		{
			field: "grantTypesList",
			headerName: "Grant Types",
			flex: 1,
			minWidth: 250,
			renderCell: (value: string[]) => (
				<div className="flex flex-wrap gap-1">
					{value?.slice(0, 2).map((grantType: string) => (
						<Badge key={grantType} variant="secondary">
							{grantType.replace("_", " ")}
						</Badge>
					))}
					{value?.length > 2 && <Badge variant="outline">+{value.length - 2}</Badge>}
				</div>
			),
		},
		{
			field: "scopeList",
			headerName: "Scopes",
			flex: 1,
			minWidth: 200,
			renderCell: (value: string[]) => (
				<div className="flex flex-wrap gap-1">
					{value?.slice(0, 3).map((scope: string) => (
						<Badge key={scope} variant="outline">
							{scope}
						</Badge>
					))}
					{value?.length > 3 && <Badge variant="outline">+{value.length - 3}</Badge>}
				</div>
			),
		},
		{
			field: "client_secret",
			headerName: "Type",
			width: 120,
			renderCell: (_value: any, row: any) => {
				const clientType = getClientType(row as OAuth2Client);
				return <Badge variant={clientType === "confidential" ? "default" : "secondary"}>{clientType}</Badge>;
			},
		},
		{
			field: "createdDate",
			headerName: "Created",
			width: 120,
			renderCell: (value: string) => <span>{value || "Unknown"}</span>,
		},
		{
			field: "actions",
			headerName: "Actions",
			width: 80,
			sortable: false,
			renderCell: (_value: any, row: any) => (
				<Button variant="ghost" size="icon" onClick={(event) => handleMenuClick(event, row.id)}>
					<Icon name="more-vertical" />
				</Button>
			),
		},
	];

	// Show empty state when Hydra is disabled
	if (!hydraEnabled) {
		return (
			<ProtectedPage>
				<div className="space-y-6">
					<PageHeader title="OAuth2 Clients" subtitle="Manage OAuth2 client applications and their configurations" icon={<Icon name="grid" />} />
					<Card>
						<EmptyState
							icon={<Icon name="cloud-off" />}
							title="Hydra Integration Disabled"
							description="Hydra integration is currently disabled. Enable it in Settings to manage OAuth2 clients."
							action={{
								label: "Go to Settings",
								onClick: () => router.push("/settings"),
								icon: <Icon name="settings" />,
							}}
						/>
					</Card>
				</div>
			</ProtectedPage>
		);
	}

	return (
		<ProtectedPage>
			<div className="space-y-6">
				<PageHeader
					title="OAuth2 Clients"
					subtitle="Manage OAuth2 client applications and their configurations"
					icon={<Icon name="grid" />}
					actions={
						<ActionBar
							primaryAction={{
								label: "Create Client",
								icon: <Icon name="add" />,
								onClick: () => router.push("/clients/create"),
							}}
						/>
					}
				/>

				{/* Stats Cards */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard title="Total Clients" value={clientsData?.totalCount || 0} icon={<Icon name="users" />} colorVariant="primary" />
					<StatCard title="Public Clients" value={clients.filter((c) => !c.client_secret).length} icon={<Icon name="globe" />} colorVariant="blue" />
					<StatCard
						title="Confidential Clients"
						value={clients.filter((c) => !!c.client_secret).length}
						icon={<Icon name="lock" />}
						colorVariant="purple"
					/>
					<StatCard
						title="Auth Code Flow"
						value={clients.filter((c) => c.grant_types?.includes("authorization_code")).length}
						icon={<Icon name="key-round" />}
						colorVariant="success"
					/>
				</div>

				{/* Search */}
				<SectionCard>
					<SearchBar value={searchTerm} onChange={setSearchTerm} placeholder="Search clients by name, ID, or owner..." />
				</SectionCard>

				{/* Error Display */}
				{error && <ErrorState variant="inline" message={`Failed to load OAuth2 clients: ${error.message}`} />}

				{/* Data Table */}
				<Card>
					<DataTable
						data={filteredRows}
						columns={columns}
						keyField="id"
						loading={isLoading}
						searchable={false}
						onRowClick={(row) => router.push(`/clients/${row.id}`)}
						pagination
						pageSize={25}
						pageSizeOptions={[10, 25, 50, 100]}
					/>
				</Card>

				{/* Context Menu (dropdown) */}
				{menuOpen && menuPosition && (
					<>
						{/* Backdrop to close the menu */}
						<div className="fixed inset-0 z-40" onClick={handleMenuClose} />
						<div
							ref={menuRef}
							className="fixed z-50 min-w-[160px] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md"
							style={{ top: menuPosition.top, left: menuPosition.left }}
						>
							<button
								type="button"
								className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
								onClick={() => selectedClient && handleView(selectedClient)}
							>
								<Icon name="view" />
								View Details
							</button>
							<button
								type="button"
								className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
								onClick={() => selectedClient && handleEdit(selectedClient)}
							>
								<Icon name="edit" />
								Edit Client
							</button>
							<button
								type="button"
								className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
								onClick={() => selectedClient && handleDeleteClick(selectedClient)}
							>
								<Icon name="delete" />
								Delete Client
							</button>
						</div>
					</>
				)}

				{/* Delete Confirmation Dialog */}
				<Dialog open={deleteDialogOpen} onOpenChange={(open) => !open && handleDeleteCancel()}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Delete OAuth2 Client</DialogTitle>
							<DialogDescription>Are you sure you want to delete this OAuth2 client? This action cannot be undone.</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<ActionBar
								align="right"
								primaryAction={{
									label: "Delete",
									onClick: handleDeleteConfirm,
									loading: deleteClientMutation.isPending,
									disabled: deleteClientMutation.isPending,
								}}
								secondaryActions={[
									{
										label: "Cancel",
										onClick: handleDeleteCancel,
										variant: "outline",
									},
								]}
							/>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</ProtectedPage>
	);
}
