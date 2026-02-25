import { DataTable, type DataTableColumn, Icon, StatusBadge, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@olympusoss/canvas";
import React, { useMemo } from "react";
import { formatDate } from "@/lib/date-utils";

interface SessionsTableProps {
	sessions: any[];
	isLoading: boolean;
	isFetchingNextPage: boolean;
	searchQuery: string;
	onSessionClick?: (sessionId: string) => void;
}

// Helper functions for session data processing
const getIdentityDisplay = (session: any): string => {
	if (!session.identity) return "Unknown";
	const traits = session.identity.traits;
	if (!traits) return session.identity.id;
	return traits.email || traits.username || session.identity.id;
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

export const SessionsTable: React.FC<SessionsTableProps> = React.memo(
	({ sessions, isLoading, isFetchingNextPage: _isFetchingNextPage, searchQuery, onSessionClick }) => {
		// Define columns for the DataTable
		const columns: DataTableColumn[] = useMemo(
			() => [
				{
					field: "id",
					headerName: "Session ID",
					minWidth: 200,
					maxWidth: 250,
					renderCell: (value: string) => (
						<TooltipProvider delayDuration={0}>
							<Tooltip>
								<TooltipTrigger asChild>
									<code>{value.substring(0, 8)}...</code>
								</TooltipTrigger>
								<TooltipContent>{value}</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					),
				},
				{
					field: "identity",
					headerName: "Identity",
					minWidth: 200,
					maxWidth: 250,
					renderCell: (_: any, session: any) => <span>{getIdentityDisplay(session)}</span>,
				},
				{
					field: "active",
					headerName: "Status",
					minWidth: 120,
					renderCell: (value: boolean) => <StatusBadge status={value ? "active" : "inactive"} label={value ? "Active" : "Inactive"} showIcon />,
				},
				{
					field: "authenticated_at",
					headerName: "Authenticated At",
					minWidth: 180,
					renderCell: (value: string) =>
						value ? (
							<div>
								<Icon name="time" />
								<span>{formatDate(value)}</span>
							</div>
						) : (
							<span>N/A</span>
						),
				},
				{
					field: "expires_at",
					headerName: "Expires",
					minWidth: 160,
					renderCell: (value: string) => {
						if (!value) return <span>N/A</span>;

						const timeRemaining = getTimeRemaining(value);
						const isExpiringSoon = timeRemaining?.includes("m remaining");

						return (
							<div>
								{isExpiringSoon && <Icon name="danger" />}
								<span>{timeRemaining}</span>
							</div>
						);
					},
				},
			],
			[],
		);

		const handleRowClick = (session: any) => {
			onSessionClick?.(session.id);
		};

		const emptyStateMessage = searchQuery ? "Try a different search term" : "Sessions will appear here when users log in";

		return (
			<DataTable
				data={sessions}
				columns={columns}
				keyField="id"
				loading={isLoading}
				searchable={false} // Search is handled externally
				onRowClick={handleRowClick}
				emptyMessage={emptyStateMessage}
			/>
		);
	},
);

SessionsTable.displayName = "SessionsTable";
