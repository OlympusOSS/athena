import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CredentialDeleteDialog } from "@/features/identities/components/CredentialDeleteDialog";

import "./snapshot-setup";

const mutateAsync = vi.fn();
const state: { isPending: boolean; isError: boolean; error: Error | null } = {
	isPending: false,
	isError: false,
	error: null,
};

vi.mock("@/features/identities/hooks/useIdentities", () => ({
	useDeleteIdentityCredentials: () => ({
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

vi.mock("@/lib/logger", () => ({ uiLogger: { debug: vi.fn(), logError: vi.fn() } }));

beforeEach(() => {
	mutateAsync.mockReset();
	state.isPending = false;
	state.isError = false;
	state.error = null;
});

describe("CredentialDeleteDialog", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(<CredentialDeleteDialog open={true} onClose={() => {}} identityId="abc-123" credentialType="password" />);
		expect(baseElement).toMatchSnapshot();
	});

	it("clicks Delete Credential, calls mutateAsync and closes on success", async () => {
		mutateAsync.mockResolvedValue(undefined);
		const onClose = vi.fn();
		const onSuccess = vi.fn();
		const { getAllByText } = render(
			<CredentialDeleteDialog open={true} onClose={onClose} identityId="abc-123" credentialType="password" onSuccess={onSuccess} />,
		);
		const btns = getAllByText("Delete Credential");
		await act(async () => {
			fireEvent.click(btns[btns.length - 1]);
		});
		await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ id: "abc-123", type: "password" }));
		expect(onSuccess).toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
	});

	it("includes identifier when credential type is oidc", async () => {
		mutateAsync.mockResolvedValue(undefined);
		const { getAllByText } = render(
			<CredentialDeleteDialog open={true} onClose={() => {}} identityId="abc-123" credentialType="oidc" identifier="google:123" />,
		);
		const btns = getAllByText("Delete Credential");
		await act(async () => {
			fireEvent.click(btns[btns.length - 1]);
		});
		await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ id: "abc-123", type: "oidc", identifier: "google:123" }));
	});

	it("renders totp/webauthn/lookup_secret specific warning bullets", () => {
		const { unmount } = render(<CredentialDeleteDialog open={true} onClose={() => {}} identityId="x" credentialType="totp" />);
		unmount();
		const { unmount: u2 } = render(<CredentialDeleteDialog open={true} onClose={() => {}} identityId="x" credentialType="webauthn" />);
		u2();
		const { baseElement } = render(<CredentialDeleteDialog open={true} onClose={() => {}} identityId="x" credentialType="lookup_secret" />);
		expect(baseElement.textContent).toMatch(/backup codes/i);
	});

	it("clicks Cancel calls onClose", () => {
		const onClose = vi.fn();
		const { getByText } = render(<CredentialDeleteDialog open={true} onClose={onClose} identityId="x" credentialType="password" />);
		fireEvent.click(getByText("Cancel"));
		expect(onClose).toHaveBeenCalled();
	});

	it("shows error alert when mutation errored", () => {
		state.isError = true;
		state.error = new Error("permission denied");
		const { getByText } = render(<CredentialDeleteDialog open={true} onClose={() => {}} identityId="x" credentialType="password" />);
		expect(getByText(/Failed to delete credential: permission denied/)).toBeInTheDocument();
	});

	it("shows Deleting... while pending", () => {
		state.isPending = true;
		const { getAllByText } = render(<CredentialDeleteDialog open={true} onClose={() => {}} identityId="x" credentialType="password" />);
		expect(getAllByText(/Deleting/).length).toBeGreaterThan(0);
	});

	it("handles mutation error and logs", async () => {
		mutateAsync.mockRejectedValue(new Error("bad"));
		const { getAllByText } = render(<CredentialDeleteDialog open={true} onClose={() => {}} identityId="x" credentialType="password" />);
		const btns = getAllByText("Delete Credential");
		await act(async () => {
			fireEvent.click(btns[btns.length - 1]);
		});
		await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
	});
});
