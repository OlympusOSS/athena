import type { Identity } from "@ory/kratos-client";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type DataTableColumn, Icon } from "@olympus/canvas";
import { StatusBadge } from "@olympus/canvas";
import { ErrorState, LoadingState } from "@olympus/canvas";
import { Badge } from "@olympus/canvas";
import { Button } from "@olympus/canvas";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@olympus/canvas";
import { useIdentities, useIdentitiesSearch } from "@/features/identities/hooks";
import { useSchemas } from "@/features/schemas/hooks";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@olympus/canvas";
import { BulkOperationDialog } from "./BulkOperationDialog";

type BulkOpType = "delete" | "deleteSessions" | "activate" | "deactivate";

const IdentitiesTable: React.FC = React.memo(() => {
	const router = useRouter();
	const [searchTerm, setSearchTerm] = useState("");
	const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
	const [pageSize, _setPageSize] = useState(25);
	const [pageToken, _setPageToken] = useState<string | undefined>(undefined);
	const [_pageHistory, _setPageHistory] = useState<(string | undefined)[]>([undefined]);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [bulkOperation, setBulkOperation] = useState<BulkOpType | null>(null);

	// Debounce search term
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchTerm(searchTerm);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchTerm]);

	const isSearching = debouncedSearchTerm.trim().length > 0;

	const {
		data: regularData,
		isLoading: regularLoading,
		isError: regularError,
		error: regularErrorDetails,
		refetch: regularRefetch,
	} = useIdentities({
		pageSize,
		pageToken,
	});

	const { data: searchData, isLoading: searchLoading } = useIdentitiesSearch({
		pageSize,
		searchTerm: debouncedSearchTerm,
	});

	const { data: schemas } = useSchemas();

	const data = regularData;
	const isLoading = regularLoading;
	const isError = regularError;
	const error = regularErrorDetails;
	const refetch = regularRefetch;

	const baseIdentities = useMemo(() => data?.identities || [], [data?.identities]);
	const hasMore = data?.hasMore || false;
	const _nextPageToken = data?.nextPageToken;
	const searchResults = searchData?.identities || [];
	const searchComplete = !searchLoading && isSearching;

	// Helper functions
	const getSchemaName = React.useCallback(
		(identity: Identity) => {
			const schema = schemas?.find((s) => s.id === identity.schema_id);
			const schemaObj = schema?.schema as any;
			return schemaObj?.title || `Schema ${identity.schema_id?.substring(0, 8)}...` || "Unknown";
		},
		[schemas],
	);

	const getIdentifier = React.useCallback(
		(identity: Identity) => {
			const traits = identity.traits as any;
			const schema = schemas?.find((s) => s.id === identity.schema_id);
			const schemaObj = schema?.schema as any;

			if (!schemaObj?.properties?.traits?.properties) {
				return traits?.email || traits?.username || traits?.phone || "N/A";
			}

			const traitProperties = schemaObj.properties.traits.properties;
			const identifierFields: string[] = [];

			Object.keys(traitProperties).forEach((fieldName) => {
				const field = traitProperties[fieldName];
				const kratosConfig = field?.["ory.sh/kratos"];

				if (kratosConfig?.credentials) {
					const credentialTypes = Object.keys(kratosConfig.credentials);
					const hasIdentifier = credentialTypes.some((credType) => kratosConfig.credentials[credType]?.identifier === true);

					if (hasIdentifier) {
						identifierFields.push(fieldName);
					}
				}
			});

			for (const fieldName of identifierFields) {
				const value = traits?.[fieldName];
				if (value) {
					return String(value);
				}
			}

			return traits?.email || traits?.username || traits?.phone || "N/A";
		},
		[schemas],
	);

	// Apply client-side filtering
	const clientFilteredIdentities = useMemo(() => {
		if (!searchTerm.trim()) return baseIdentities;

		const searchLower = searchTerm.toLowerCase();
		return baseIdentities.filter((identity: Identity) => {
			const traits = identity.traits as any;
			const email = String(traits?.email || "");
			const firstName = String(traits?.first_name || traits?.firstName || "");
			const lastName = String(traits?.last_name || traits?.lastName || "");
			const name = String(traits?.name || "");
			const id = String(identity.id || "");
			const schemaName = getSchemaName(identity);
			const identifier = getIdentifier(identity);

			return (
				id.toLowerCase().includes(searchLower) ||
				email.toLowerCase().includes(searchLower) ||
				firstName.toLowerCase().includes(searchLower) ||
				lastName.toLowerCase().includes(searchLower) ||
				name.toLowerCase().includes(searchLower) ||
				schemaName.toLowerCase().includes(searchLower) ||
				identifier.toLowerCase().includes(searchLower)
			);
		});
	}, [baseIdentities, searchTerm, getSchemaName, getIdentifier]);

	const shouldUseSearchResults = searchComplete && isSearching;
	const displayedIdentities = shouldUseSearchResults ? searchResults : clientFilteredIdentities;

	// Define columns
	const columns: DataTableColumn[] = useMemo(
		() => [
			{
				field: "id",
				headerName: "ID",
				minWidth: 180,
				maxWidth: 200,
				renderCell: (value: string) => (
					<TooltipProvider delayDuration={0}>
						<Tooltip>
							<TooltipTrigger asChild>
								<code>
									{value.substring(0, 8)}...
								</code>
							</TooltipTrigger>
							<TooltipContent>{value}</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				),
			},
			{
				field: "identifier",
				headerName: "Identifier",
				minWidth: 220,
				renderCell: (_: unknown, identity: Identity) => (
					<span>
						{getIdentifier(identity)}
					</span>
				),
			},
			{
				field: "schema_id",
				headerName: "Schema",
				minWidth: 140,
				renderCell: (_: unknown, identity: Identity) => (
					<Badge variant="secondary">{getSchemaName(identity)}</Badge>
				),
			},
			{
				field: "state",
				headerName: "State",
				minWidth: 100,
				renderCell: (value: string) => (
					<StatusBadge
						status={value === "active" ? "active" : "inactive"}
						label={value === "active" ? "Active" : "Inactive"}
						size="small"
					/>
				),
			},
			{
				field: "created_at",
				headerName: "Created",
				minWidth: 180,
				renderCell: (value: string) => <span>{formatDate(value)}</span>,
			},
			{
				field: "updated_at",
				headerName: "Updated",
				minWidth: 180,
				renderCell: (value: string) => <span>{formatDate(value)}</span>,
			},
		],
		[getSchemaName, getIdentifier],
	);

	const handleRowClick = (row: Record<string, unknown>) => {
		router.push(`/identities/${row.id}`);
	};

	const handleCreateNew = () => {
		router.push("/identities/create");
	};

	const handleRefresh = () => {
		refetch();
	};

	const handleSearchChange = (value: string) => {
		setSearchTerm(value);
	};

	const handleBulkSuccess = useCallback(() => {
		setSelectedIds(new Set());
	}, []);

	if (isLoading && !baseIdentities.length) {
		return <LoadingState variant="page" />;
	}

	if (isError) {
		return (
			<ErrorState
				variant="page"
				message={(error as Error)?.message || "Unable to fetch identities. Please check your connection and try again."}
				action={{ label: "Retry", onClick: () => refetch() }}
			/>
		);
	}

	return (
		<div>
			{/* Bulk action toolbar */}
			{selectedIds.size > 0 && (
				<div>
					<Badge variant="outline">{selectedIds.size} selected</Badge>
					<Button variant="destructive" size="sm" onClick={() => setBulkOperation("delete")}>
						<Icon name="delete" />
						Delete
					</Button>
					<Button variant="outline" size="sm" onClick={() => setBulkOperation("deleteSessions")}>
						<Icon name="logout" />
						Delete Sessions
					</Button>
					<Button variant="outline" size="sm" onClick={() => setBulkOperation("activate")}>
						<Icon name="success" />
						Activate
					</Button>
					<Button variant="outline" size="sm" onClick={() => setBulkOperation("deactivate")}>
						<Icon name="blocked" />
						Deactivate
					</Button>
					<TooltipProvider delayDuration={0}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon" onClick={() => setSelectedIds(new Set())}>
									<Icon name="close" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Clear selection</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			)}

			<DataTable
				data={displayedIdentities}
				columns={columns}
				keyField="id"
				loading={isLoading}
				selectable={true}
				selectedKeys={selectedIds}
				onSelectionChange={setSelectedIds}
				searchable={true}
				searchValue={searchTerm}
				onSearchChange={handleSearchChange}
				searchPlaceholder="Search identities (ID, identifier, schema, name)..."
				onRowClick={handleRowClick}
				onRefresh={handleRefresh}
				onAdd={handleCreateNew}
				addButtonText="Create New"
				emptyMessage="No identities found"
			/>

			{/* Pagination info */}
			<div>
				<p>
					{searchTerm.trim()
						? `Found ${displayedIdentities.length} matches${shouldUseSearchResults ? " (from multi-page search)" : " (from current page)"}`
						: `Showing ${displayedIdentities.length} identities${hasMore ? " (more available)" : ""}`}
				</p>
			</div>

			{/* Bulk operation dialog */}
			{bulkOperation && (
				<BulkOperationDialog
					open={!!bulkOperation}
					onClose={() => setBulkOperation(null)}
					operationType={bulkOperation}
					identityIds={Array.from(selectedIds)}
					identities={displayedIdentities}
					onSuccess={handleBulkSuccess}
				/>
			)}
		</div>
	);
});

IdentitiesTable.displayName = "IdentitiesTable";

export default IdentitiesTable;
