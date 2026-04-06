"use client";

/**
 * Machine-to-Machine (M2M) OAuth2 Client Management Page
 *
 * /applications/m2m — Admin UI for registering, viewing, rotating secrets for,
 * and deleting M2M OAuth2 clients for AI agents and automated services.
 *
 * AC1: Applications > Machine-to-Machine section (clearly separate from user-facing OAuth2 clients)
 * AC2: List with name, client ID (truncated), token lifetime, created date, action buttons
 * AC4: SecretRevealModal shows client_id + client_secret once on creation (C3/SR-3)
 * AC5: Rotate Secret — same one-time modal pattern
 * AC6: Delete with confirmation showing client name
 * AC7: Code snippet panel (collapsible "How to use" section)
 */

import {
	Badge,
	Button,
	Card,
	DataTable,
	type DataTableColumn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	EmptyState,
	ErrorState,
	Icon,
	StatCard,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@olympusoss/canvas";
import { useCallback, useState } from "react";
import { ActionBar, PageHeader, ProtectedPage, SectionCard } from "@/components/layout";
import {
	CreateM2MClientModal,
	DeleteM2MClientModal,
	formatTokenLifetime,
	getTokenLifetimeSeconds,
	type M2MClient,
	RotateSecretModal,
	SecretRevealModal,
	useCreateM2MClient,
	useDeleteM2MClient,
	useM2MClients,
	useRotateM2MSecret,
} from "@/features/m2m-clients";
import { formatClientId } from "@/features/oauth2-clients";
import { useCopyToClipboard, useDialog } from "@/hooks";

// Code snippet panel component (AC7)
function HowToUsePanel({ clientId }: { clientId?: string }) {
	const [expanded, setExpanded] = useState(false);
	const { copy, copiedField } = useCopyToClipboard();

	const curlExample = `curl -X POST https://<olympus-domain>/oauth2/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials" \\
  -d "client_id=${clientId ?? "<your_client_id>"}" \\
  -d "client_secret=<your_client_secret>" \\
  -d "scope=<your_scope>"`;

	return (
		<SectionCard>
			<button type="button" className="flex w-full items-center justify-between" onClick={() => setExpanded((v) => !v)}>
				<div className="flex items-center gap-2">
					<Icon name="code" />
					<span className="text-sm font-medium text-foreground">How to use client credentials</span>
				</div>
				<Icon name="chevron-down" style={expanded ? { transform: "rotate(180deg)" } : undefined} />
			</button>

			{expanded && (
				<div className="mt-4 space-y-3">
					<p className="text-sm text-muted-foreground">
						Use the <code className="font-mono text-xs">client_credentials</code> grant to obtain an access token. Agents must re-authenticate when
						the token expires — no refresh tokens are issued.
					</p>
					<div className="relative">
						<pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 font-mono text-xs text-foreground">{curlExample}</pre>
						<TooltipProvider delayDuration={0}>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="absolute right-2 top-2"
										onClick={() => copy(curlExample, "curl")}
										aria-label="Copy curl example"
									>
										<Icon name={copiedField === "curl" ? "check" : "copy"} />
									</Button>
								</TooltipTrigger>
								<TooltipContent>{copiedField === "curl" ? "Copied!" : "Copy"}</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
					<p className="text-xs text-muted-foreground">
						See <code className="font-mono">docs/state/m2m-quickstart.md</code> for language-specific examples (TypeScript, Python, Go) and the scope
						reference.
					</p>
				</div>
			)}
		</SectionCard>
	);
}

export default function M2MClientsPage() {
	const { data, isLoading, error: listError } = useM2MClients();
	const createMutation = useCreateM2MClient();
	const rotateMutation = useRotateM2MSecret();
	const deleteMutation = useDeleteM2MClient();

	const { copy } = useCopyToClipboard();

	// Dialog state
	const { isOpen: createOpen, open: openCreate, close: closeCreate } = useDialog();
	const { isOpen: secretOpen, open: openSecret, close: closeSecret } = useDialog();
	const { isOpen: rotateConfirmOpen, open: openRotateConfirm, close: closeRotateConfirm } = useDialog();
	const { isOpen: deleteOpen, open: openDelete, close: closeDelete } = useDialog();

	const [targetClient, setTargetClient] = useState<M2MClient | null>(null);
	const [revealedCredentials, setRevealedCredentials] = useState<{
		clientId: string;
		clientSecret: string;
		displayType: "creation" | "rotation";
	} | null>(null);
	const [lastCreatedClientId, setLastCreatedClientId] = useState<string | undefined>();

	const clients = data?.clients ?? [];

	// Create client
	const handleCreateSubmit = useCallback(
		async (values: { client_name: string; scope: string; token_lifetime: number }) => {
			const result = await createMutation.mutateAsync({
				client_name: values.client_name,
				scope: values.scope,
				token_lifetime: values.token_lifetime,
			});

			setRevealedCredentials({
				clientId: result.client_id,
				clientSecret: result.client_secret,
				displayType: "creation",
			});
			setLastCreatedClientId(result.client_id);
			closeCreate();
			openSecret();
		},
		[createMutation, closeCreate, openSecret],
	);

	// After SecretRevealModal closes — clear mutation state (D2 / athena#50 plan)
	const handleSecretDone = useCallback(() => {
		closeSecret();
		setRevealedCredentials(null);
		createMutation.reset();
		rotateMutation.reset();
	}, [closeSecret, createMutation, rotateMutation]);

	const handleSecretAbandon = useCallback(() => {
		closeSecret();
		setRevealedCredentials(null);
		createMutation.reset();
		rotateMutation.reset();
	}, [closeSecret, createMutation, rotateMutation]);

	// Rotate secret
	const handleRotateClick = useCallback(
		(client: M2MClient) => {
			setTargetClient(client);
			openRotateConfirm();
		},
		[openRotateConfirm],
	);

	const handleRotateConfirm = useCallback(async () => {
		if (!targetClient?.client_id) return;

		const result = await rotateMutation.mutateAsync(targetClient.client_id);

		setRevealedCredentials({
			clientId: result.client_id,
			clientSecret: result.client_secret,
			displayType: "rotation",
		});
		closeRotateConfirm();
		openSecret();
	}, [targetClient, rotateMutation, closeRotateConfirm, openSecret]);

	// Delete client
	const handleDeleteClick = useCallback(
		(client: M2MClient) => {
			setTargetClient(client);
			openDelete();
		},
		[openDelete],
	);

	const handleDeleteConfirm = useCallback(async () => {
		if (!targetClient?.client_id) return;
		await deleteMutation.mutateAsync(targetClient.client_id);
		closeDelete();
		setTargetClient(null);
	}, [targetClient, deleteMutation, closeDelete]);

	// Table columns
	const columns: DataTableColumn[] = [
		{
			field: "client_name",
			headerName: "Name",
			flex: 1,
			minWidth: 200,
			renderCell: (value: string, row: M2MClient) => (
				<div className="space-y-0.5">
					<span className="font-medium text-foreground">{value || "Unnamed"}</span>
					<br />
					<code className="text-xs font-mono text-muted-foreground">{formatClientId(row.client_id)}</code>
				</div>
			),
		},
		{
			field: "scope",
			headerName: "Scopes",
			flex: 1,
			minWidth: 200,
			renderCell: (value: string) => (
				<div className="flex flex-wrap gap-1">
					{(value ?? "")
						.split(" ")
						.filter(Boolean)
						.map((scope) => (
							<Badge key={scope} variant="outline">
								{scope}
							</Badge>
						))}
				</div>
			),
		},
		{
			field: "client_credentials_grant_access_token_lifespan",
			headerName: "Token Lifetime",
			width: 140,
			renderCell: (_value: string, row: M2MClient) => {
				const seconds = getTokenLifetimeSeconds(row);
				return (
					<span className="text-sm text-foreground">
						{formatTokenLifetime(seconds)} <span className="text-muted-foreground">({seconds}s)</span>
					</span>
				);
			},
		},
		{
			field: "created_at",
			headerName: "Created",
			width: 120,
			renderCell: (value: string) => <span className="text-sm text-foreground">{value ? new Date(value).toLocaleDateString() : "Unknown"}</span>,
		},
		{
			field: "actions",
			headerName: "",
			width: 80,
			sortable: false,
			renderCell: (_value: unknown, row: M2MClient) => (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" onClick={(e: React.MouseEvent) => e.stopPropagation()} aria-label="Client actions">
							<Icon name="more-vertical" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							onClick={(e: React.MouseEvent) => {
								e.stopPropagation();
								copy(row.client_id, row.client_id);
							}}
						>
							<Icon name="copy" />
							Copy Client ID
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={(e: React.MouseEvent) => {
								e.stopPropagation();
								handleRotateClick(row);
							}}
						>
							<Icon name="refresh" />
							Rotate Secret
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							onClick={(e: React.MouseEvent) => {
								e.stopPropagation();
								handleDeleteClick(row);
							}}
						>
							<Icon name="delete" />
							Delete Client
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			),
		},
	];

	return (
		<ProtectedPage>
			<div className="space-y-6">
				<PageHeader
					title="Machine-to-Machine"
					subtitle="Register OAuth2 clients for AI agents and automated services using the client credentials grant"
					icon={<Icon name="server" />}
					breadcrumbs={[{ label: "Applications" }, { label: "Machine-to-Machine" }]}
					actions={
						<ActionBar
							primaryAction={{
								label: "Add M2M Client",
								icon: <Icon name="add" />,
								onClick: openCreate,
							}}
						/>
					}
				/>

				{/* Stats */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<StatCard title="Total M2M Clients" value={isLoading ? 0 : clients.length} icon={<Icon name="server" />} colorVariant="primary" />
					<StatCard
						title="Clients with Sessions:Invalidate"
						value={isLoading ? 0 : clients.filter((c) => c.scope?.includes("sessions:invalidate")).length}
						icon={<Icon name="danger" />}
						colorVariant="warning"
					/>
					<StatCard
						title="Avg Token Lifetime"
						value={
							isLoading || clients.length === 0
								? "—"
								: `${formatTokenLifetime(Math.round(clients.reduce((sum, c) => sum + getTokenLifetimeSeconds(c), 0) / clients.length))}`
						}
						icon={<Icon name="time" />}
						colorVariant="blue"
					/>
				</div>

				{/* How to use (code snippet panel) */}
				<HowToUsePanel clientId={lastCreatedClientId} />

				{/* Error state */}
				{listError && <ErrorState variant="inline" message={`Failed to load M2M clients: ${listError.message}`} />}

				{/* Client list */}
				<Card>
					{!isLoading && clients.length === 0 && !listError ? (
						<EmptyState
							icon={<Icon name="server" />}
							title="No M2M clients registered"
							description="Register a machine-to-machine client to allow AI agents and services to authenticate with client credentials."
							action={{
								label: "Add M2M Client",
								onClick: openCreate,
								icon: <Icon name="add" />,
							}}
						/>
					) : (
						<DataTable
							data={clients}
							columns={columns}
							keyField="client_id"
							loading={isLoading}
							searchable={false}
							pagination
							pageSize={25}
							pageSizeOptions={[10, 25, 50]}
						/>
					)}
				</Card>
			</div>

			{/* Create modal */}
			<CreateM2MClientModal
				open={createOpen}
				onOpenChange={(open) => {
					if (!open) closeCreate();
				}}
				onSubmit={handleCreateSubmit}
				isSubmitting={createMutation.isPending}
				error={createMutation.error}
			/>

			{/* Secret reveal modal (one-time display) */}
			{revealedCredentials && (
				<SecretRevealModal
					open={secretOpen}
					onDone={handleSecretDone}
					onAbandon={handleSecretAbandon}
					clientId={revealedCredentials.clientId}
					clientSecret={revealedCredentials.clientSecret}
					displayType={revealedCredentials.displayType}
				/>
			)}

			{/* Rotate secret confirmation modal */}
			<RotateSecretModal
				open={rotateConfirmOpen}
				onOpenChange={(open) => {
					if (!open) {
						closeRotateConfirm();
						rotateMutation.reset();
					}
				}}
				onConfirm={handleRotateConfirm}
				clientName={targetClient?.client_name}
				clientId={targetClient?.client_id ?? ""}
				isRotating={rotateMutation.isPending}
				error={rotateMutation.error}
			/>

			{/* Delete confirmation modal */}
			<DeleteM2MClientModal
				open={deleteOpen}
				onOpenChange={(open) => {
					if (!open) {
						closeDelete();
						deleteMutation.reset();
					}
				}}
				onConfirm={handleDeleteConfirm}
				clientName={targetClient?.client_name}
				clientId={targetClient?.client_id ?? ""}
				isDeleting={deleteMutation.isPending}
				error={deleteMutation.error}
			/>
		</ProtectedPage>
	);
}
