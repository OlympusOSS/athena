import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MessagesTable } from "@/features/messages/components/MessagesTable";

import "./snapshot-setup";

describe("MessagesTable", () => {
	it("matches snapshot (empty)", () => {
		const { container } = render(<MessagesTable messages={[]} isLoading={false} />);
		expect(container).toMatchSnapshot();
	});

	it("renders populated data including all columns", () => {
		const messages = [
			{
				id: "m1",
				type: "email",
				recipient: "to@example.com",
				subject: "Welcome",
				status: "sent",
				template_type: "welcome",
				created_at: "2024-01-01T00:00:00Z",
				send_count: 2,
			},
			{
				id: "m2",
				type: "sms",
				recipient: "+15555551234",
				subject: "",
				status: "queued",
				template_type: "",
				created_at: "2024-01-01T00:00:00Z",
				send_count: 0,
			},
			{
				id: "m3",
				type: "other",
				recipient: "x",
				subject: "z",
				status: "processing",
				template_type: "t",
				created_at: "2024-01-01T00:00:00Z",
				send_count: 1,
			},
			{
				id: "m4",
				type: "email",
				recipient: "a",
				subject: "abandoned-sub",
				status: "abandoned",
				template_type: "t",
				created_at: "2024-01-01T00:00:00Z",
				send_count: 5,
			},
			{
				id: "m5",
				type: "email",
				recipient: "a",
				subject: "u",
				status: "unknown",
				template_type: "t",
				created_at: "2024-01-01T00:00:00Z",
				send_count: 0,
			},
		];
		const { container } = render(<MessagesTable messages={messages as never} isLoading={false} />);
		expect(container.textContent).toMatch(/to@example.com/);
		expect(container.textContent).toMatch(/No subject/);
		expect(container.textContent).toMatch(/welcome/);
	});

	it("invokes onMessageClick when row clicked", () => {
		const onMessageClick = vi.fn();
		const messages = [
			{
				id: "m1",
				type: "email",
				recipient: "a",
				subject: "b",
				status: "sent",
				template_type: "t",
				created_at: "2024-01-01T00:00:00Z",
				send_count: 1,
			},
		];
		const { container } = render(<MessagesTable messages={messages as never} isLoading={false} onMessageClick={onMessageClick} />);
		const row = container.querySelector("tbody tr");
		if (row) fireEvent.click(row);
		expect(onMessageClick).toHaveBeenCalledWith("m1");
	});
});
