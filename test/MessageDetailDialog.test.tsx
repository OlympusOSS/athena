import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MessageDetailDialog } from "@/features/messages/components/MessageDetailDialog";

import "./snapshot-setup";

const state: {
	data: { data: Record<string, unknown> } | null;
	isLoading: boolean;
	error: Error | null;
} = {
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
};

vi.mock("@/features/messages/hooks", () => ({
	useMessage: () => state,
}));

beforeEach(() => {
	state.data = {
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
	};
	state.isLoading = false;
	state.error = null;
});

describe("MessageDetailDialog", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(<MessageDetailDialog open={true} onClose={() => {}} messageId="msg-1" />);
		expect(baseElement).toMatchSnapshot();
	});

	it("shows LoadingState when loading", () => {
		state.isLoading = true;
		state.data = null;
		const { baseElement } = render(<MessageDetailDialog open={true} onClose={() => {}} messageId="msg-1" />);
		expect(baseElement.querySelector(".lucide-loader-circle, .animate-spin")).toBeTruthy();
	});

	it("shows ErrorState when fetchError", () => {
		state.error = new Error("boom");
		state.data = null;
		const { getByText } = render(<MessageDetailDialog open={true} onClose={() => {}} messageId="msg-1" />);
		expect(getByText(/Failed to load message details: boom/)).toBeInTheDocument();
	});

	it("shows ErrorState when no data and no fetchError (fallback unknown)", () => {
		state.data = null;
		state.error = null;
		const { getByText } = render(<MessageDetailDialog open={true} onClose={() => {}} messageId="msg-1" />);
		expect(getByText(/Unknown error/)).toBeInTheDocument();
	});

	it("renders dispatches with errors", () => {
		state.data = {
			data: {
				id: "msg-2",
				type: "sms",
				status: "queued",
				send_count: 0,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
				template_type: "",
				channel: "",
				recipient: "+1",
				subject: "",
				body: "",
				dispatches: [
					{
						id: "d1",
						status: "failed",
						created_at: "2024-01-01T00:00:00Z",
						updated_at: "2024-01-01T00:00:00Z",
						error: { msg: "transient" },
					},
				],
			},
		};
		const { getByText } = render(<MessageDetailDialog open={true} onClose={() => {}} messageId="msg-2" />);
		expect(getByText(/1 dispatch/)).toBeInTheDocument();
	});

	it("renders message with status abandoned + processing status icons", () => {
		state.data = {
			data: {
				id: "msg-3",
				type: "sms",
				status: "abandoned",
				send_count: 0,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
				template_type: "",
				channel: "",
				recipient: "",
				subject: "",
				body: "",
				dispatches: [],
			},
		};
		const { baseElement } = render(<MessageDetailDialog open={true} onClose={() => {}} messageId="msg-3" />);
		expect(baseElement.textContent).toMatch(/abandoned/);
	});

	it("renders no subject fallback", () => {
		state.data = {
			data: {
				id: "m",
				type: "email",
				status: "unknown",
				send_count: 0,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
				template_type: "",
				channel: "",
				recipient: "",
				subject: "",
				body: "",
				dispatches: [],
			},
		};
		const { getByText } = render(<MessageDetailDialog open={true} onClose={() => {}} messageId="m" />);
		expect(getByText(/No subject/)).toBeInTheDocument();
	});

	it("renders processing dispatch status and unknown type", () => {
		state.data = {
			data: {
				id: "m",
				type: "other",
				status: "processing",
				send_count: 2,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
				template_type: "x",
				channel: "c",
				recipient: "r",
				subject: "s",
				body: "",
				dispatches: [],
			},
		};
		const { baseElement } = render(<MessageDetailDialog open={true} onClose={() => {}} messageId="m" />);
		expect(baseElement.textContent).toMatch(/processing/);
	});
});
