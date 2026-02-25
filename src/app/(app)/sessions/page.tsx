"use client";

import { Button, Card, CardContent, ErrorState, Icon, SearchBar, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@olympusoss/canvas";
import { useCallback, useEffect, useState } from "react";
import { AdminLayout, PageHeader } from "@/components/layout";
import { UserRole } from "@/features/auth";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { SessionDetailDialog } from "@/features/sessions/components/SessionDetailDialog";
import { SessionsTable } from "@/features/sessions/components/SessionsTable";
import { useSessionsPaginated, useSessionsWithSearch } from "@/features/sessions/hooks/useSessions";
import { useStableSessions } from "@/features/sessions/hooks/useStableSessions";

export default function SessionsPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

	// Debounce search query to avoid excessive API calls
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchQuery(searchQuery.trim());
		}, 300);

		return () => clearTimeout(timer);
	}, [searchQuery]);

	const trimmedSearchQuery = debouncedSearchQuery;

	// Use infinite pagination when not searching
	const paginatedQuery = useSessionsPaginated({ pageSize: 250 });

	// Use search query when there's a search term
	const searchQuery_ = useSessionsWithSearch(trimmedSearchQuery);

	// Choose which query to use based on search state
	const isSearching = !!trimmedSearchQuery;
	const activeQuery = isSearching ? searchQuery_ : paginatedQuery;

	// Get sessions from the appropriate source (removed useMemo for better reactivity)
	const sessions = isSearching
		? searchQuery_.data?.pages.flatMap((page) => page.sessions) || []
		: paginatedQuery.data?.pages.flatMap((page) => page.sessions) || [];

	// Unified loading and error states
	const isLoading = activeQuery.isLoading;
	const isError = activeQuery.isError;
	const error = activeQuery.error;

	// Pagination-specific states - works for both modes now
	const fetchNextPage = isSearching ? searchQuery_.fetchNextPage : paginatedQuery.fetchNextPage;
	const hasNextPage = isSearching ? searchQuery_.hasNextPage : paginatedQuery.hasNextPage;
	const isFetchingNextPage = isSearching ? searchQuery_.isFetchingNextPage : paginatedQuery.isFetchingNextPage;

	// Refetch function that works for both modes
	const refetch = () => {
		if (isSearching) {
			searchQuery_.refetch();
		} else {
			paginatedQuery.refetch();
		}
	};

	// Helper to get identity display name - memoized for stability
	const getIdentityDisplay = useCallback((session: Record<string, unknown>) => {
		if (!(session as { identity?: { traits?: Record<string, string>; id?: string } }).identity) return "Unknown";

		const identity = (session as { identity: { traits?: Record<string, string>; id?: string } }).identity;
		const traits = identity.traits;
		if (!traits) return identity.id || "Unknown";

		return traits.email || traits.username || identity.id || "Unknown";
	}, []);

	// Use the stable sessions hook for truly stable references
	const stableSessionsState = useStableSessions({
		sessions,
		searchQuery: trimmedSearchQuery,
		getIdentityDisplay,
	});

	const stableFilteredSessions = stableSessionsState.sessions;

	const handleSessionClick = (sessionId: string) => {
		setSelectedSessionId(sessionId);
	};

	const handleDialogClose = () => {
		setSelectedSessionId(null);
	};

	return (
		<ProtectedRoute requiredRole={UserRole.ADMIN}>
			<AdminLayout>
				<div className="space-y-6">
					<PageHeader
						title="Active Sessions"
						subtitle="Monitor and manage user sessions across your system"
						icon={<Icon name="shield" />}
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
								<h2 className="text-lg font-semibold text-foreground">All Sessions</h2>
								<div className="w-full max-w-sm">
									<SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search sessions..." />
								</div>
							</div>

							{isError ? (
								<ErrorState
									message={error?.message || "Unable to fetch sessions. Please check your connection and try again."}
									action={{
										label: "Retry",
										onClick: refetch,
									}}
								/>
							) : (
								<>
									<SessionsTable
										key={`${paginatedQuery.dataUpdatedAt}-${searchQuery_.dataUpdatedAt}`} // Force re-render when data updates
										sessions={stableFilteredSessions}
										isLoading={isLoading}
										isFetchingNextPage={false} // Don't cause re-renders for fetching state
										searchQuery={searchQuery}
										onSessionClick={handleSessionClick}
									/>

									{/* Loading/pagination controls for search mode */}
									{isSearching && hasNextPage && (
										<div className="flex items-center justify-center py-4">
											{searchQuery_.isAutoSearching ? (
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													<Icon name="loading" className="h-4 w-4 animate-spin" />
													<span>Searching for more sessions...</span>
												</div>
											) : (
												<Button variant="outline" onClick={() => searchQuery_.loadMoreMatches()}>
													<Icon name="chevron-down" />
													Load More Matches
												</Button>
											)}
										</div>
									)}

									{/* Manual load more for browsing mode */}
									{!isSearching && hasNextPage && (
										<div className="flex items-center justify-center py-4">
											<Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
												{isFetchingNextPage ? <Icon name="loading" /> : <Icon name="chevron-down" />}
												{isFetchingNextPage ? "Loading..." : "Load More Sessions"}
											</Button>
										</div>
									)}

									{/* Sessions count info */}
									<div className="py-2 text-center">
										<p className="text-sm text-muted-foreground">
											{isSearching ? (
												<>
													Found {stableFilteredSessions.length} sessions matching &ldquo;{trimmedSearchQuery}&rdquo;
													{(() => {
														// Use the isAutoSearching state from the hook
														if (searchQuery_.isAutoSearching) {
															return " (auto-searching...)";
														}
														// Regular search behavior
														if (searchQuery_.isFetchingNextPage) {
															return " (searching...)";
														}
														if (hasNextPage) {
															return " (more available)";
														}
														return "";
													})()}
												</>
											) : (
												<>
													Showing {stableFilteredSessions.length} sessions
													{hasNextPage && " (more available)"}
												</>
											)}
										</p>
									</div>
								</>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardContent>
							<h2 className="text-lg font-semibold text-foreground">About Sessions</h2>
							<p className="text-sm text-muted-foreground">
								This page shows all active sessions across all identities in the system. Sessions are automatically created when users authenticate
								and expire based on your Kratos configuration. Use this page to monitor user activity and troubleshoot authentication issues.
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Session Detail Dialog */}
				{selectedSessionId && (
					<SessionDetailDialog
						open={true}
						onClose={handleDialogClose}
						sessionId={selectedSessionId}
						onSessionUpdated={() => {
							// Refetch the active query
							if (isSearching) {
								searchQuery_.refetch();
							} else {
								paginatedQuery.refetch();
							}
						}}
					/>
				)}
			</AdminLayout>
		</ProtectedRoute>
	);
}
