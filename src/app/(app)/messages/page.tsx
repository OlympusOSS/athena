"use client";

import {
	Button,
	Card,
	CardContent,
	ErrorState,
	Icon,
	LoadingState,
	SearchBar,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@olympusoss/canvas";
import type { Message } from "@ory/kratos-client";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout, PageHeader } from "@/components/layout";
import { UserRole } from "@/features/auth";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { MessageDetailDialog, MessagesTable } from "@/features/messages/components";
import { useMessagesPaginated, useMessagesWithSearch } from "@/features/messages/hooks";
import type { CourierMessageStatus } from "@/services/kratos/endpoints/courier";

export default function MessagesPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<CourierMessageStatus | "">("");
	const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

	// Debounce search query
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchQuery(searchQuery.trim());
		}, 300);

		return () => clearTimeout(timer);
	}, [searchQuery]);

	const trimmedSearchQuery = debouncedSearchQuery;

	// Use infinite pagination when not searching
	const paginatedQuery = useMessagesPaginated({
		pageSize: 250,
		status: statusFilter || undefined,
	});

	// Use search query when there's a search term
	const searchQuery_ = useMessagesWithSearch(trimmedSearchQuery, statusFilter || undefined);

	// Choose which query to use based on search state
	const isSearching = !!trimmedSearchQuery;
	const activeQuery = isSearching ? searchQuery_ : paginatedQuery;

	// Get messages from the appropriate source
	const messages = useMemo(() => {
		const allMessages = isSearching
			? searchQuery_.data?.pages.flatMap((page) => page.messages) || []
			: paginatedQuery.data?.pages.flatMap((page) => page.messages) || [];

		// Apply client-side search filtering when searching
		if (!trimmedSearchQuery) {
			return allMessages;
		}

		const searchLower = trimmedSearchQuery.toLowerCase();
		return allMessages.filter((message: Message) => {
			return (
				(message.recipient as string | undefined)?.toLowerCase().includes(searchLower) ||
				(message.subject as string | undefined)?.toLowerCase().includes(searchLower) ||
				(message.id as string | undefined)?.toLowerCase().includes(searchLower) ||
				(message.template_type as string | undefined)?.toLowerCase().includes(searchLower) ||
				(message.type as string | undefined)?.toLowerCase().includes(searchLower)
			);
		});
	}, [isSearching, searchQuery_.data, paginatedQuery.data, trimmedSearchQuery]);

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

	const handleMessageClick = (messageId: string) => {
		setSelectedMessageId(messageId);
	};

	const handleClearFilters = () => {
		setSearchQuery("");
		setStatusFilter("");
	};

	return (
		<ProtectedRoute requiredRole={UserRole.ADMIN}>
			<AdminLayout>
				<div className="space-y-6">
					<PageHeader
						title="Messages"
						subtitle="Monitor email and SMS messages sent through Kratos"
						icon={<Icon name="mail" />}
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
							{/* Filters */}
							<div className="flex flex-wrap items-center gap-3">
								<div className="flex-1 min-w-[200px]">
									<SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search messages (recipient, subject, ID, template...)..." />
								</div>

								<Select
									value={statusFilter || "all"}
									onValueChange={(value) => setStatusFilter(value === "all" ? "" : (value as CourierMessageStatus))}
								>
									<SelectTrigger>
										<SelectValue placeholder="Status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Statuses</SelectItem>
										<SelectItem value="queued">Queued</SelectItem>
										<SelectItem value="processing">Processing</SelectItem>
										<SelectItem value="sent">Sent</SelectItem>
										<SelectItem value="abandoned">Abandoned</SelectItem>
									</SelectContent>
								</Select>

								{(searchQuery || statusFilter) && (
									<Button variant="outline" onClick={handleClearFilters}>
										<Icon name="close" />
										Clear Filters
									</Button>
								)}
							</div>

							{/* Messages Table */}
							{isError ? (
								<ErrorState
									message={error?.message || "Unable to fetch messages. Please check your connection and try again."}
									action={{ label: "Retry", onClick: refetch }}
								/>
							) : isLoading ? (
								<LoadingState variant="section" message="Loading messages..." />
							) : (
								<>
									<MessagesTable messages={messages} isLoading={isLoading} onMessageClick={handleMessageClick} />

									{/* Loading/pagination controls for search mode */}
									{isSearching && hasNextPage && (
										<div className="flex items-center justify-center py-4">
											{searchQuery_.isAutoSearching ? (
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													<Icon name="loading" />
													<span>Searching for more messages...</span>
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
												{isFetchingNextPage ? "Loading..." : "Load More Messages"}
											</Button>
										</div>
									)}

									{/* Messages count */}
									<div className="py-2 text-center">
										<p className="text-sm text-muted-foreground">
											{isSearching ? (
												<>
													Found {messages.length} message(s) matching &ldquo;
													{trimmedSearchQuery}&rdquo;
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
													Showing {messages.length} message(s)
													{hasNextPage && " (more available)"}
												</>
											)}
										</p>
									</div>
								</>
							)}
						</CardContent>
					</Card>

					{/* Message Detail Dialog */}
					{selectedMessageId && <MessageDetailDialog open={true} onClose={() => setSelectedMessageId(null)} messageId={selectedMessageId} />}
				</div>
			</AdminLayout>
		</ProtectedRoute>
	);
}
