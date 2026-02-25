import { DataTable, type DataTableColumn, Icon, StatusBadge } from "@olympusoss/canvas";
import React, { useMemo } from "react";
import { formatDate } from "@/lib/date-utils";
import type { CourierMessageStatus } from "@/services/kratos/endpoints/courier";

interface MessagesTableProps {
	messages: any[];
	isLoading: boolean;
	onMessageClick?: (messageId: string) => void;
}

const getStatusIcon = (status: CourierMessageStatus): React.ReactNode => {
	switch (status) {
		case "sent":
			return <Icon name="success-filled" />;
		case "queued":
			return <Icon name="time" />;
		case "processing":
			return <Icon name="time" />;
		case "abandoned":
			return <Icon name="x-circle" />;
		default:
			return <Icon name="error" />;
	}
};

const _getStatusColor = (status: CourierMessageStatus): string => {
	switch (status) {
		case "sent":
			return "success";
		case "queued":
			return "info";
		case "processing":
			return "warning";
		case "abandoned":
			return "error";
		default:
			return "default";
	}
};

const getMessageTypeIcon = (type: string): React.ReactNode => {
	switch (type) {
		case "email":
			return <Icon name="mail" />;
		case "sms":
			return <Icon name="message" />;
		default:
			return <Icon name="mail" />;
	}
};

export const MessagesTable: React.FC<MessagesTableProps> = React.memo(({ messages, isLoading, onMessageClick }) => {
	const columns: DataTableColumn[] = useMemo(
		() => [
			{
				field: "type",
				headerName: "Type",
				minWidth: 120,
				renderCell: (value: string) => (
					<div>
						{getMessageTypeIcon(value)}
						<span>{value}</span>
					</div>
				),
			},
			{
				field: "recipient",
				headerName: "Recipient",
				minWidth: 200,
				maxWidth: 250,
				renderCell: (value: string) => <span>{value}</span>,
			},
			{
				field: "subject",
				headerName: "Subject",
				minWidth: 250,
				maxWidth: 300,
				renderCell: (value: string) => <span>{value || "No subject"}</span>,
			},
			{
				field: "status",
				headerName: "Status",
				minWidth: 150,
				renderCell: (value: CourierMessageStatus) => (
					<div>
						{getStatusIcon(value)}
						<StatusBadge status={value === "sent" ? "active" : value === "queued" ? "pending" : "inactive"} label={value} showIcon={false} />
					</div>
				),
			},
			{
				field: "template_type",
				headerName: "Template",
				minWidth: 160,
				renderCell: (value: string) => <code>{value || "Unknown"}</code>,
			},
			{
				field: "created_at",
				headerName: "Created",
				minWidth: 180,
				renderCell: (value: string) => <span>{formatDate(value)}</span>,
			},
			{
				field: "send_count",
				headerName: "Send Count",
				minWidth: 120,
				renderCell: (value: number) => <span>{value || 0}</span>,
			},
		],
		[],
	);

	const handleRowClick = (message: any) => {
		onMessageClick?.(message.id);
	};

	return (
		<DataTable
			data={messages}
			columns={columns}
			keyField="id"
			loading={isLoading}
			searchable={false}
			onRowClick={handleRowClick}
			emptyMessage="No messages found"
		/>
	);
});

MessagesTable.displayName = "MessagesTable";
