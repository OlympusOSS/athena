"use client";

import {
	Button,
	DataTable,
	type DataTableColumn,
	Icon,
	StatusBadge,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@olympusoss/canvas";
import React, { useMemo } from "react";
import { useUnlockAccount } from "../hooks/useLockedAccounts";
import type { LockedAccount } from "../types";

interface LockedAccountsTableProps {
	accounts: LockedAccount[];
	isLoading: boolean;
	onUnlockSuccess?: (identifier: string) => void;
	onUnlockError?: (identifier: string, error: Error) => void;
}

function getTimeRemaining(lockedUntil: Date | null): string {
	if (!lockedUntil) return "Unknown";

	const now = Date.now();
	const until = lockedUntil.getTime();
	const diff = until - now;

	if (diff <= 0) return "Expired";

	const minutes = Math.ceil(diff / 60_000);
	if (minutes < 60) return `${minutes}m remaining`;

	const hours = Math.ceil(diff / 3_600_000);
	return `${hours}h remaining`;
}

export function LockedAccountsTable({ accounts, isLoading, onUnlockSuccess, onUnlockError }: LockedAccountsTableProps) {
	const unlockMutation = useUnlockAccount();

	const handleUnlock = React.useCallback(
		async (identifier: string) => {
			try {
				await unlockMutation.mutateAsync(identifier);
				onUnlockSuccess?.(identifier);
			} catch (error) {
				onUnlockError?.(identifier, error instanceof Error ? error : new Error(String(error)));
			}
		},
		[unlockMutation, onUnlockSuccess, onUnlockError],
	);

	const columns: DataTableColumn[] = useMemo(
		() => [
			{
				field: "identifier",
				headerName: "Identifier",
				minWidth: 220,
				renderCell: (value: string) => (
					<TooltipProvider delayDuration={0}>
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="font-mono text-sm">{value}</span>
							</TooltipTrigger>
							<TooltipContent>{value}</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				),
			},
			{
				field: "lock_reason",
				headerName: "Reason",
				minWidth: 140,
				renderCell: (value: string | null) => <StatusBadge status="inactive" label={value ?? "unknown"} showIcon />,
			},
			{
				field: "trigger_ip",
				headerName: "Source IP",
				minWidth: 140,
				renderCell: (value: string | null) => <span className="font-mono text-sm">{value ?? "—"}</span>,
			},
			{
				field: "auto_threshold_at",
				headerName: "Failed Attempts",
				minWidth: 140,
				renderCell: (value: number | null) => <span className="text-sm text-foreground">{value != null ? String(value) : "—"}</span>,
			},
			{
				field: "locked_at",
				headerName: "Locked At",
				minWidth: 180,
				renderCell: (value: Date | null) =>
					value ? (
						<div className="flex items-center gap-1.5">
							<Icon name="time" className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-sm">{value.toLocaleString()}</span>
						</div>
					) : (
						<span className="text-sm text-muted-foreground">—</span>
					),
			},
			{
				field: "locked_until",
				headerName: "Expires",
				minWidth: 200,
				renderCell: (value: Date | null) => {
					const label = getTimeRemaining(value);
					const isExpired = label === "Expired";
					return (
						<span className={`text-sm ${isExpired ? "text-muted-foreground" : "text-foreground"}`}>
							{value ? `${value.toLocaleString()} (${label})` : "—"}
						</span>
					);
				},
			},
			{
				field: "_actions",
				headerName: "Actions",
				minWidth: 120,
				renderCell: (_value: string, row: LockedAccount) => (
					<Button
						variant="outline"
						size="sm"
						onClick={(e) => {
							e.stopPropagation();
							handleUnlock(row.identifier);
						}}
						disabled={unlockMutation.isPending}
					>
						<Icon name="key-round" className="h-3.5 w-3.5" />
						Unlock
					</Button>
				),
			},
		],
		[handleUnlock, unlockMutation.isPending],
	);

	return (
		<DataTable
			data={accounts}
			columns={columns}
			keyField="id"
			loading={isLoading}
			searchable={false}
			emptyMessage="No locked accounts — all identities are currently accessible."
		/>
	);
}
