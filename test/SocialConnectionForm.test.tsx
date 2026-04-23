import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SocialConnectionForm } from "@/app/(app)/social-connections/components/SocialConnectionForm";

import "./snapshot-setup";

const mutateAsync = vi.fn();
const state: { isPending: boolean; isError: boolean; error: Error | null } = {
	isPending: false,
	isError: false,
	error: null,
};

vi.mock("@/hooks/useSocialConnections", () => ({
	useCreateSocialConnection: () => ({
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

beforeEach(() => {
	mutateAsync.mockReset();
	state.isPending = false;
	state.isError = false;
	state.error = null;
});

describe("SocialConnectionForm", () => {
	it("matches snapshot (create)", () => {
		const { container } = render(<SocialConnectionForm mode="create" existingConnection={null} onSuccess={() => {}} onCancel={() => {}} />);
		expect(container).toMatchSnapshot();
	});

	it("submits valid form and fires onSuccess", async () => {
		mutateAsync.mockResolvedValue({ reloadStatus: { reloaded: true }, secretChanged: true });
		const onSuccess = vi.fn();
		const { container, getByText } = render(
			<SocialConnectionForm mode="create" existingConnection={null} onSuccess={onSuccess} onCancel={() => {}} />,
		);
		const clientId = container.querySelector("#client_id") as HTMLInputElement;
		fireEvent.change(clientId, { target: { value: "my-id.apps.googleusercontent.com" } });
		const secret = container.querySelector("#client_secret") as HTMLInputElement;
		fireEvent.change(secret, { target: { value: "mysecret" } });
		await act(async () => {
			fireEvent.click(getByText("Add Connection"));
		});
		await waitFor(() => expect(onSuccess).toHaveBeenCalled());
	});

	it("validates required client_id", async () => {
		const { container, getByText, findByText } = render(
			<SocialConnectionForm mode="create" existingConnection={null} onSuccess={() => {}} onCancel={() => {}} />,
		);
		const secret = container.querySelector("#client_secret") as HTMLInputElement;
		fireEvent.change(secret, { target: { value: "a" } });
		await act(async () => {
			fireEvent.click(getByText("Add Connection"));
		});
		await findByText(/Client ID is required/);
	});

	it("validates pattern rule for client_id", async () => {
		const { container, getByText, findByText } = render(
			<SocialConnectionForm mode="create" existingConnection={null} onSuccess={() => {}} onCancel={() => {}} />,
		);
		const clientId = container.querySelector("#client_id") as HTMLInputElement;
		fireEvent.change(clientId, { target: { value: "invalid chars!!!" } });
		const secret = container.querySelector("#client_secret") as HTMLInputElement;
		fireEvent.change(secret, { target: { value: "a" } });
		await act(async () => {
			fireEvent.click(getByText("Add Connection"));
		});
		await findByText(/Client ID contains invalid characters/);
	});

	it("renders edit mode with existing connection and does not require secret", async () => {
		mutateAsync.mockResolvedValue({ reloadStatus: { reloaded: true }, secretChanged: false });
		const onSuccess = vi.fn();
		const conn = { provider: "google", client_id: "existing-id", enabled: true } as never;
		const { getByText } = render(<SocialConnectionForm mode="edit" existingConnection={conn} onSuccess={onSuccess} onCancel={() => {}} />);
		await act(async () => {
			fireEvent.click(getByText("Save Changes"));
		});
		await waitFor(() => expect(onSuccess).toHaveBeenCalled());
	});

	it("handles mutation error quietly (keeps dialog open)", async () => {
		mutateAsync.mockRejectedValue(new Error("boom"));
		const onSuccess = vi.fn();
		state.isError = true;
		state.error = new Error("boom");
		const { container, getByText } = render(
			<SocialConnectionForm mode="create" existingConnection={null} onSuccess={onSuccess} onCancel={() => {}} />,
		);
		const clientId = container.querySelector("#client_id") as HTMLInputElement;
		fireEvent.change(clientId, { target: { value: "id" } });
		const secret = container.querySelector("#client_secret") as HTMLInputElement;
		fireEvent.change(secret, { target: { value: "sec" } });
		await act(async () => {
			fireEvent.click(getByText("Add Connection"));
		});
		// Error shown
		expect(getByText("boom")).toBeInTheDocument();
	});

	it("Cancel calls onCancel", () => {
		const onCancel = vi.fn();
		const { getByText } = render(<SocialConnectionForm mode="create" existingConnection={null} onSuccess={() => {}} onCancel={onCancel} />);
		fireEvent.click(getByText("Cancel"));
		expect(onCancel).toHaveBeenCalled();
	});

	it("shows Saving... while pending", () => {
		state.isPending = true;
		const { getAllByText } = render(<SocialConnectionForm mode="create" existingConnection={null} onSuccess={() => {}} onCancel={() => {}} />);
		expect(getAllByText(/Saving/).length).toBeGreaterThan(0);
	});

	it("validates secret required in create mode", async () => {
		const { container, getByText, findByText } = render(
			<SocialConnectionForm mode="create" existingConnection={null} onSuccess={() => {}} onCancel={() => {}} />,
		);
		const clientId = container.querySelector("#client_id") as HTMLInputElement;
		fireEvent.change(clientId, { target: { value: "id" } });
		await act(async () => {
			fireEvent.click(getByText("Add Connection"));
		});
		await findByText(/Client secret is required/);
	});

	it("defaults with generic error message when error.message missing", () => {
		state.isError = true;
		state.error = null;
		const { getByText } = render(<SocialConnectionForm mode="create" existingConnection={null} onSuccess={() => {}} onCancel={() => {}} />);
		expect(getByText(/Failed to save connection/)).toBeInTheDocument();
	});
});
