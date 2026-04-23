import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MessageDetailDialog } from "@/features/messages/components/MessageDetailDialog";

import "./snapshot-setup";

vi.mock("@/features/messages/hooks", () => ({
	useMessage: () => ({
		data: {
			data: {
				id: "msg-1",
				type: "email",
				status: "sent",
				send_count: 1,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
				template_type: "recovery",
				channel: "default",
				recipient: "user@example.com",
				subject: "Recover your account",
				body: "Body",
				dispatches: [],
			},
		},
		isLoading: false,
		error: null,
	}),
}));

describe("MessageDetailDialog", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(<MessageDetailDialog open={true} onClose={() => {}} messageId="msg-1" />);
		expect(baseElement).toMatchSnapshot();
	});
});
