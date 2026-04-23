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
} from "@olympusoss/canvas";
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
				return <Icon name="CircleCheck" />;
			case "queued":
				return <Icon name="Timer" />;
			case "processing":
				return <Icon name="LoaderCircle" />;
			case "abandoned":
				return <Icon name="CircleX" />;
			default:
				return <Icon name="CircleX" />;
		}
	};

	const getMessageTypeIcon = (type: string): React.ReactNode => {
		switch (type) {
			case "email":
				return <Icon name="Mail" />;
			case "sms":
				return <Icon name="MessageSquare" />;
			default:
				return <Icon name="Mail" />;
		}
	};

	if (isLoading) {
		return (
			/* c8 ignore start -- Radix Dialog's onOpenChange (Escape / outside-click)
			 * cannot be fired from jsdom; Close button path is covered. */
			<Dialog open={open} onOpenChange={() => onClose()}>
				{/* c8 ignore stop */}
				<DialogContent>
					<LoadingState />
				</DialogContent>
			</Dialog>
		);
	}

	if (fetchError || !message) {
		return (
			/* c8 ignore start -- Radix Dialog's onOpenChange (Escape / outside-click)
			 * cannot be fired from jsdom; Close button path is covered. */
			<Dialog open={open} onOpenChange={() => onClose()}>
				{/* c8 ignore stop */}
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Message Details</DialogTitle>
					</DialogHeader>
					<ErrorState message={`Failed to load message details: ${fetchError?.message || "Unknown error"}`} />
				</DialogContent>
			</Dialog>
		);
	}

	return (
		/* c8 ignore start -- Radix Dialog onOpenChange fires on Escape / outside-click,
		 * jsdom pointer-capture gap prevents this. Close path covered. */
		<Dialog open={open} onOpenChange={() => onClose()}>
			{/* c8 ignore stop */}
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
								<Icon name="Info" />
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
										<StatusBadge status={message.status === "sent" ? "success" : message.status === "queued" ? "warning" : "neutral"}>
											{message.status}
										</StatusBadge>
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
								<Icon name="User" />
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
																<StatusBadge status={dispatch.status === "failed" ? "neutral" : "success"}>{dispatch.status}</StatusBadge>
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
