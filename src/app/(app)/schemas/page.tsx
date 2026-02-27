"use client";

import {
	Badge,
	Button,
	Card,
	CardContent,
	CodeBlock,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	EmptyState,
	ErrorState,
	Icon,
	LoadingState,
	SearchBar,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@olympusoss/canvas";
import type { IdentitySchemaContainer } from "@ory/kratos-client";
import { useEffect, useState } from "react";
import { AdminLayout, PageHeader } from "@/components/layout";
import { UserRole } from "@/features/auth";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { useSchemas } from "@/features/schemas/hooks";
import { getIdentitySchema } from "@/services/kratos";

export default function SchemasPage() {
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);
	const [selectedSchemaId, setSelectedSchemaId] = useState<string | null>(null);
	const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);
	const [schemaContent, setSchemaContent] = useState<object | null>(null);
	const [schemaLoading, setSchemaLoading] = useState(false);
	const [parsedSchemas, setParsedSchemas] = useState<IdentitySchemaContainer[]>([]);
	const [searchQuery, setSearchQuery] = useState("");

	const { data: schemasResponse, isLoading, error, refetch } = useSchemas();

	// Update parsed schemas when the response changes
	useEffect(() => {
		if (schemasResponse) {
			setParsedSchemas(Array.isArray(schemasResponse) ? schemasResponse : []);
		}
	}, [schemasResponse]);

	const handleChangePage = (newPage: number) => {
		setPage(newPage);
	};

	const handleChangeRowsPerPage = (value: string) => {
		setRowsPerPage(parseInt(value, 10));
		setPage(0);
	};

	const handleViewSchema = async (id: string) => {
		setSelectedSchemaId(id);
		setSchemaLoading(true);
		setSchemaDialogOpen(true);

		try {
			// First try to find the schema in the already loaded data
			const existingSchema = parsedSchemas.find((schema) => schema.id === id);

			if (existingSchema) {
				setSchemaContent(existingSchema.schema);
				setSchemaLoading(false);
				return;
			}

			// If not found, fetch it from the API
			const response = await getIdentitySchema({ id });
			setSchemaContent(response.data);
		} catch (err) {
			console.error("Error fetching schema:", err);
			setSchemaContent(null);
		} finally {
			setSchemaLoading(false);
		}
	};

	const handleCloseSchemaDialog = () => {
		setSchemaDialogOpen(false);
		setSelectedSchemaId(null);
		setSchemaContent(null);
	};

	// Extract schema title or use ID if title is not available
	const getSchemaTitle = (schema: IdentitySchemaContainer) => {
		const s = schema.schema as Record<string, unknown>;
		return (s.title as string) || "Unnamed Schema";
	};

	// Get schema properties count
	const getPropertiesCount = (schema: IdentitySchemaContainer) => {
		const s = schema.schema as Record<string, unknown>;
		const properties = s.properties as Record<string, unknown> | undefined;
		const traits = (properties?.traits as Record<string, unknown>)?.properties as Record<string, unknown> | undefined;
		return traits ? Object.keys(traits).length : 0;
	};

	// Filter schemas based on search query
	const filteredSchemas = parsedSchemas.filter((schema) => {
		const title = getSchemaTitle(schema).toLowerCase();
		const id = schema.id.toLowerCase();
		const query = searchQuery.toLowerCase();
		return title.includes(query) || id.includes(query);
	});

	// Pagination
	const totalPages = Math.ceil(filteredSchemas.length / rowsPerPage);
	const paginatedSchemas = filteredSchemas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

	return (
		<ProtectedRoute requiredRole={UserRole.VIEWER}>
			<AdminLayout>
				<div className="space-y-6">
					<PageHeader
						title="Identity Schemas"
						subtitle="View and inspect your identity schemas and their properties"
						icon={<Icon name="shapes" />}
						actions={
							<TooltipProvider delayDuration={0}>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button variant="ghost" size="icon" onClick={() => refetch()}>
											<Icon name="refresh" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Refresh</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						}
					/>

					<Card>
						<CardContent>
							<div className="flex items-center justify-between">
								<h2 className="text-lg font-semibold text-foreground">All Schemas</h2>
								<div className="w-full max-w-sm">
									<SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search schemas..." />
								</div>
							</div>

							{isLoading ? (
								<LoadingState variant="section" message="Loading schemas..." />
							) : error ? (
								<ErrorState
									message="Unable to fetch identity schemas. Please check your connection and try again."
									action={{ label: "Retry", onClick: refetch }}
								/>
							) : (
								<>
									<div className="overflow-auto rounded-md border">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>ID</TableHead>
													<TableHead>Title</TableHead>
													<TableHead>Type</TableHead>
													<TableHead>Properties</TableHead>
													<TableHead>Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{paginatedSchemas.length === 0 ? (
													<TableRow>
														<TableCell colSpan={5}>
															<EmptyState
																icon={<Icon name="file-text" />}
																title="No schemas found"
																description={searchQuery ? "Try a different search term" : "No schemas are currently configured"}
															/>
														</TableCell>
													</TableRow>
												) : (
													paginatedSchemas.map((schema) => (
														<TableRow key={schema.id}>
															<TableCell>
																<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{schema.id}</code>
															</TableCell>
															<TableCell>{getSchemaTitle(schema)}</TableCell>
															<TableCell>
																<Badge variant="secondary">{((schema.schema as Record<string, unknown>).type as string) || "unknown"}</Badge>
															</TableCell>
															<TableCell>
																<Badge variant="outline">{getPropertiesCount(schema)} trait(s)</Badge>
															</TableCell>
															<TableCell>
																<div className="flex items-center gap-1">
																	<Button variant="outline" size="sm" onClick={() => handleViewSchema(schema.id)}>
																		<Icon name="code" />
																		View Schema
																	</Button>
																	<Button variant="ghost" size="icon">
																		<Icon name="more-vertical" />
																	</Button>
																</div>
															</TableCell>
														</TableRow>
													))
												)}
											</TableBody>
										</Table>
									</div>

									{/* Pagination */}
									<div className="flex items-center justify-between px-2 py-4">
										<div className="flex items-center gap-2">
											<span className="text-sm text-muted-foreground">Rows per page:</span>
											<Select value={String(rowsPerPage)} onValueChange={handleChangeRowsPerPage}>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="5">5</SelectItem>
													<SelectItem value="10">10</SelectItem>
													<SelectItem value="25">25</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className="flex items-center gap-2">
											<span className="text-sm text-muted-foreground">
												{page * rowsPerPage + 1}
												&ndash;
												{Math.min((page + 1) * rowsPerPage, filteredSchemas.length)} of {filteredSchemas.length}
											</span>
											<Button variant="ghost" size="icon" disabled={page === 0} onClick={() => handleChangePage(page - 1)}>
												&lsaquo;
											</Button>
											<Button variant="ghost" size="icon" disabled={page >= totalPages - 1} onClick={() => handleChangePage(page + 1)}>
												&rsaquo;
											</Button>
										</div>
									</div>
								</>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardContent>
							<h2 className="text-lg font-semibold text-foreground">About Identity Schemas</h2>
							<p className="text-sm text-muted-foreground">
								Identity schemas define the structure of identity data in Ory Kratos. They determine what fields are available for registration,
								login, and profile management. Use schemas to customize the user experience and data collection for your application.
							</p>
						</CardContent>
					</Card>

					{/* Schema Dialog */}
					<Dialog open={schemaDialogOpen} onOpenChange={(open) => !open && handleCloseSchemaDialog()}>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>
									Schema Details {selectedSchemaId && <code className="text-sm font-mono text-muted-foreground">(ID: {selectedSchemaId})</code>}
								</DialogTitle>
							</DialogHeader>
							<div className="space-y-4">
								{schemaLoading ? (
									<LoadingState variant="section" message="Loading schema details..." />
								) : schemaContent ? (
									<CodeBlock code={JSON.stringify(schemaContent, null, 2)} language="json" maxHeight="60vh" />
								) : (
									<p className="text-sm text-muted-foreground">Failed to load schema content. Please try again.</p>
								)}
							</div>
							<DialogFooter>
								<Button variant="outline" onClick={handleCloseSchemaDialog}>
									Close
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
