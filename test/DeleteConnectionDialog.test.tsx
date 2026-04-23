import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteConnectionDialog } from "@/app/(app)/social-connections/components/DeleteConnectionDialog";

import "./snapshot-setup";

const mutate = vi.fn();
const state: { isPending: boolean; isError: boolean; error: Error | null } = {
	isPending: false,
	isError: false,
	error: null,
};

vi.mock("@/hooks/useSocialConnections", () => ({
	useDeleteSocialConnection: () => ({
		mutate,
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

describe("DeleteConnectionDialog", () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		mutate.mockReset();
		state.isPending = false;
		state.isError = false;
		state.error = null;
		fetchMock = vi.fn();
		globalThis.fetch = fetchMock as unknown as typeof fetch;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("matches snapshot (open)", () => {
		fetchMock.mockResolvedValue(new Response("{}", { status: 200, headers: { "X-Total-Count": "10" } }));
		const { baseElement } = render(<DeleteConnectionDialog open={true} provider="google" onSuccess={() => {}} onCancel={() => {}} />);
		expect(baseElement).toMatchSnapshot();
	});

	it("displays affected user count when available", async () => {
		fetchMock.mockResolvedValue(new Response("{}", { status: 200, headers: { "X-Total-Count": "42" } }));
		const { findByText } = render(<DeleteConnectionDialog open={true} provider="google" onSuccess={() => {}} onCancel={() => {}} />);
		await findByText("42");
	});

	it("shows 'Unable to determine' when count unavailable (no header)", async () => {
		fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
		const { findByText } = render(<DeleteConnectionDialog open={true} provider="google" onSuccess={() => {}} onCancel={() => {}} />);
		await findByText(/Unable to determine/);
	});

	it("handles fetch failure gracefully", async () => {
		fetchMock.mockRejectedValue(new Error("timeout"));
		const { findByText } = render(<DeleteConnectionDialog open={true} provider="google" onSuccess={() => {}} onCancel={() => {}} />);
		await findByText(/Unable to determine/);
	});

	it("handles non-ok response as unable to determine", async () => {
		fetchMock.mockResolvedValue(new Response("err", { status: 500 }));
		const { findByText } = render(<DeleteConnectionDialog open={true} provider="google" onSuccess={() => {}} onCancel={() => {}} />);
		await findByText(/Unable to determine/);
	});

	it("falls back to provider string when not in display map", async () => {
		fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
		const { findAllByText } = render(<DeleteConnectionDialog open={true} provider="mystery" onSuccess={() => {}} onCancel={() => {}} />);
		const els = await findAllByText(/mystery/);
		expect(els.length).toBeGreaterThan(0);
	});

	it("clicks Remove button, calls mutate, and fires onSuccess", async () => {
		fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
		mutate.mockImplementation((_provider, { onSuccess }) => {
			onSuccess({ reloadStatus: { reloaded: true } });
		});
		const onSuccess = vi.fn();
		const { findByText, getAllByText } = render(<DeleteConnectionDialog open={true} provider="google" onSuccess={onSuccess} onCancel={() => {}} />);
		await findByText(/Unable to determine|[0-9]/);
		const removeBtns = getAllByText(/Remove Google/);
		await act(async () => {
			fireEvent.click(removeBtns[removeBtns.length - 1]);
		});
		await waitFor(() => expect(onSuccess).toHaveBeenCalled());
	});

	it("clicks Cancel button fires onCancel", async () => {
		fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
		const onCancel = vi.fn();
		const { getByText } = render(<DeleteConnectionDialog open={true} provider="github" onSuccess={() => {}} onCancel={onCancel} />);
		fireEvent.click(getByText("Cancel"));
		expect(onCancel).toHaveBeenCalled();
	});

	it("shows error alert when mutation fails", async () => {
		fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
		state.isError = true;
		state.error = new Error("API fail");
		const { findByText } = render(<DeleteConnectionDialog open={true} provider="apple" onSuccess={() => {}} onCancel={() => {}} />);
		await findByText("API fail");
	});

	it("shows default error message when error has no message", async () => {
		fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
		state.isError = true;
		state.error = null;
		const { findByText } = render(<DeleteConnectionDialog open={true} provider="facebook" onSuccess={() => {}} onCancel={() => {}} />);
		await findByText(/Failed to delete connection/);
	});

	it("shows Removing... while pending", async () => {
		fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
		state.isPending = true;
		const { findByText } = render(<DeleteConnectionDialog open={true} provider="linkedin" onSuccess={() => {}} onCancel={() => {}} />);
		await findByText(/Removing/);
	});

	it("does not fetch when dialog is closed", () => {
		render(<DeleteConnectionDialog open={false} provider="google" onSuccess={() => {}} onCancel={() => {}} />);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
