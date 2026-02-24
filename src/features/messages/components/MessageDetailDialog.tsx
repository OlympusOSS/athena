import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	ErrorState,
	Icon,
	LoadingState,
	ScrollArea,
	StatusBadge,
} from "@olympus/canvas";
import type React from "react";
import { formatDate } from "@/lib/date-utils";
import type { CourierMessageStatus } from "@/services/kratos/endpoints/courier";
import { useMessage } from "../hooks";

interface MessageDetailDialogProps {
	open: boolean;
	onClose: () => void;
	messageId: string;
}

export const MessageDetailDialog: React.FC<MessageDetailDialogProps> = ({ open, onClose, messageId }) => {
	const { data: messageData, isLoading, error: fetchError } = useMessage(messageId, { enabled: open && !!messageId });

	const message = messageData?.data;

	const getStatusIcon = (status: CourierMessageStatus): React.ReactNode => {
		switch (status) {
			case "sent":
				return <Icon name="success-filled" />;
			case "queued":
				return <Icon name="time" />;
			case "processing":
				return <Icon name="loading" />;
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

	if (isLoading) {
		return (
			<Dialog open={open} onOpenChange={() => onClose()}>
				<DialogContent>
					<LoadingState variant="section" />
				</DialogContent>
			</Dialog>
		);
	}

	if (fetchError || !message) {
		return (
			<Dialog open={open} onOpenChange={() => onClose()}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Message Details</DialogTitle>
					</DialogHeader>
					<ErrorState variant="inline" message={`Failed to load message details: ${fetchError?.message || "Unknown error"}`} />
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={() => onClose()}>
			<DialogContent>
				<DialogHeader>
					<div>
						{getMessageTypeIcon(message.type)}
						<DialogTitle>Message Details</DialogTitle>
					</div>
				</DialogHeader>

				<ScrollArea>
					<div>
						{/* Basic Message Info */}
						<div>
							<div>
								<Icon name="info" />
								<h3>Basic Information</h3>
							</div>

							<div>
								<div>
									<span>Message ID</span>
									<code>{message.id}</code>
								</div>

								<div>
									<span>Type</span>
									<div>
										{getMessageTypeIcon(message.type)}
										<span>{message.type}</span>
									</div>
								</div>

								<div>
									<span>Status</span>
									<div>
										{getStatusIcon(message.status)}
										<StatusBadge
											status={message.status === "sent" ? "active" : message.status === "queued" ? "pending" : "inactive"}
											label={message.status}
											showIcon={false}
										/>
									</div>
								</div>

								<div>
									<span>Send Count</span>
									<p>{message.send_count || 0}</p>
								</div>

								<div>
									<span>Created At</span>
									<p>{formatDate(message.created_at)}</p>
								</div>

								<div>
									<span>Updated At</span>
									<p>{formatDate(message.updated_at)}</p>
								</div>

								<div>
									<span>Template Type</span>
									<code>{message.template_type || "Unknown"}</code>
								</div>

								<div>
									<span>Channel</span>
									<p>{message.channel || "Default"}</p>
								</div>
							</div>
						</div>

						{/* Recipient Information */}
						<div>
							<div>
								<Icon name="user" />
								<h3>Recipient Information</h3>
							</div>

							<div>
								<div>
									<span>Recipient</span>
									<p>{message.recipient}</p>
								</div>

								<div>
									<span>Subject</span>
									<p>{message.subject || "No subject"}</p>
								</div>
							</div>
						</div>

						{/* Message Content */}
						{message.body && (
							<div>
								<h3>Message Content</h3>
								<div>{message.body}</div>
							</div>
						)}

						{/* Dispatches */}
						{message.dispatches && message.dispatches.length > 0 && (
							<div>
								<h3>Delivery Attempts</h3>

								<Accordion type="single" collapsible>
									<AccordionItem value="dispatches">
										<AccordionTrigger>
											<span>{message.dispatches.length} dispatch(es)</span>
										</AccordionTrigger>
										<AccordionContent>
											{message.dispatches.map((dispatch: any, _index: number) => (
												<div key={dispatch.id}>
													<div>
														<div>
															<span>Dispatch ID</span>
															<code>{dispatch.id}</code>
														</div>

														<div>
															<span>Status</span>
															<div>
																<StatusBadge status={dispatch.status === "failed" ? "inactive" : "active"} label={dispatch.status} />
															</div>
														</div>

														<div>
															<span>Created At</span>
															<p>{formatDate(dispatch.created_at)}</p>
														</div>

														<div>
															<span>Updated At</span>
															<p>{formatDate(dispatch.updated_at)}</p>
														</div>

														{dispatch.error && (
															<div>
																<span>Error</span>
																<div>
																	<code>{JSON.stringify(dispatch.error, null, 2)}</code>
																</div>
															</div>
														)}
													</div>
												</div>
											))}
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							</div>
						)}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
};
