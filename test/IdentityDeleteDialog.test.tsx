import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IdentityDeleteDialog } from "@/features/identities/components/IdentityDeleteDialog";

import "./snapshot-setup";

const mutateAsync = vi.fn();
const state: { isPending: boolean; isError: boolean; error: Error | null } = {
	isPending: false,
	isError: false,
	error: null,
};
const isDemoMock = vi.fn();

vi.mock("@/features/identities/hooks/useIdentities", () => ({
	useDeleteIdentity: () => ({
		mutateAsync,
		get isPending() {
			return state.isPending;
		},
		get isError() {
			return state.isError;
		},
		get error() {
			return state.error;
		},
	}),
}));

vi.mock("@/lib/demo", () => ({ isDemoIdentity: (...args: unknown[]) => isDemoMock(...args) }));

vi.mock("@/lib/logger", () => ({ uiLogger: { debug: vi.fn(), logError: vi.fn() } }));

const identity = {
	id: "abc-123-def-456",
	schema_id: "default",
	state: "active",
	traits: { email: "user@example.com", username: "user" },
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-01-01T00:00:00Z",
} as never;

beforeEach(() => {
	mutateAsync.mockReset();
	state.isPending = false;
	state.isError = false;
	state.error = null;
	isDemoMock.mockReset();
	isDemoMock.mockReturnValue(false);
});

describe("IdentityDeleteDialog", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(<IdentityDeleteDialog open={true} onClose={() => {}} identity={identity} />);
		expect(baseElement).toMatchSnapshot();
	});

	it("returns null when identity is null", () => {
		const { container } = render(<IdentityDeleteDialog open={true} onClose={() => {}} identity={null} />);
		expect(container.innerHTML).toBe("");
	});

	it("calls mutateAsync and closes on successful delete", async () => {
		mutateAsync.mockResolvedValue(undefined);
		const onClose = vi.fn();
		const onSuccess = vi.fn();
		const { getAllByText } = render(<IdentityDeleteDialog open={true} onClose={onClose} identity={identity} onSuccess={onSuccess} />);
		const btns = getAllByText("Delete Identity");
		await act(async () => {
			fireEvent.click(btns[btns.length - 1]);
		});
		await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(identity.id));
		expect(onSuccess).toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
	});

	it("handles mutation error by logging", async () => {
		mutateAsync.mockRejectedValue(new Error("fail"));
		const { getAllByText } = render(<IdentityDeleteDialog open={true} onClose={() => {}} identity={identity} />);
		const btns = getAllByText("Delete Identity");
		await act(async () => {
			fireEvent.click(btns[btns.length - 1]);
		});
		await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
	});

	it("shows demo account lock banner when identity is demo", () => {
		isDemoMock.mockReturnValue(true);
		const { getByText } = render(<IdentityDeleteDialog open={true} onClose={() => {}} identity={identity} />);
		expect(getByText(/protected demo account/i)).toBeInTheDocument();
	});

	it("shows error alert when mutation errored", () => {
		state.isError = true;
		state.error = new Error("500");
		const { getByText } = render(<IdentityDeleteDialog open={true} onClose={() => {}} identity={identity} />);
		expect(getByText(/Failed to delete identity: 500/)).toBeInTheDocument();
	});

	it("uses name.first name.last as displayName", () => {
		const id = {
			...identity,
			traits: { name: { first: "John", last: "Doe" } },
		};
		const { getByText } = render(<IdentityDeleteDialog open={true} onClose={() => {}} identity={id as never} />);
		expect(getByText("John Doe")).toBeInTheDocument();
	});

	it("falls back to 'Unknown User' when no name/email/username", () => {
		const id = { ...identity, traits: {} };
		const { getByText } = render(<IdentityDeleteDialog open={true} onClose={() => {}} identity={id as never} />);
		expect(getByText("Unknown User")).toBeInTheDocument();
	});

	it("Cancel button fires onClose", () => {
		const onClose = vi.fn();
		const { getByText } = render(<IdentityDeleteDialog open={true} onClose={onClose} identity={identity} />);
		fireEvent.click(getByText("Cancel"));
		expect(onClose).toHaveBeenCalled();
	});
});
