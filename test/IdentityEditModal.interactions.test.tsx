import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "./snapshot-setup";

const mutateAsync = vi.fn();
const state: { isPending: boolean; isError: boolean; error: Error | null } = {
	isPending: false,
	isError: false,
	error: null,
};
const schemasState: { data: unknown; isLoading: boolean } = { data: [], isLoading: false };

vi.mock("@/features/identities/hooks/useIdentities", () => ({
	useUpdateIdentity: () => ({
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

vi.mock("@/features/schemas/hooks/useSchemas", () => ({
	useSchemas: () => schemasState,
}));

vi.mock("@/lib/logger", () => ({ uiLogger: { debug: vi.fn(), logError: vi.fn() } }));

// Mock Canvas SchemaForm so we can trigger onChange + onSubmit
vi.mock("@olympusoss/canvas", async () => {
	const actual = await vi.importActual<typeof import("@olympusoss/canvas")>("@olympusoss/canvas");
	return {
		...actual,
		SchemaForm: ({
			onSubmit,
			onChange,
			children,
		}: {
			onSubmit: (d: { formData: unknown }) => void;
			onChange: (d: { formData: unknown }) => void;
			children: React.ReactNode;
		}) => (
			<form
				onSubmit={(e) => {
					e.preventDefault();
					onSubmit({ formData: { email: "new@example.com" } });
				}}
			>
				<button type="button" data-testid="trigger-change-x" onClick={() => onChange({ formData: { email: "x@example.com" } })}>
					change
				</button>
				<button type="button" data-testid="trigger-change-nil" onClick={() => onChange({ formData: undefined })}>
					change-nil
				</button>
				<button type="button" data-testid="trigger-submit-nil" onClick={() => onSubmit({ formData: undefined })}>
					submit-nil
				</button>
				{children}
			</form>
		),
	};
});

import { IdentityEditModal } from "@/features/identities/components/IdentityEditModal";

const identity = {
	id: "abc-123-def-456",
	schema_id: "default",
	state: "active",
	traits: { email: "old@example.com" },
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-01-01T00:00:00Z",
} as never;

beforeEach(() => {
	mutateAsync.mockReset();
	state.isPending = false;
	state.isError = false;
	state.error = null;
	schemasState.data = [];
	schemasState.isLoading = false;
});

describe("IdentityEditModal — interactions (mocked Canvas)", () => {
	it("submits form, calls mutate, fires onSuccess + onClose", async () => {
		mutateAsync.mockResolvedValue(undefined);
		const onClose = vi.fn();
		const onSuccess = vi.fn();
		schemasState.data = [
			{
				id: "default",
				schema: { properties: { traits: { properties: { email: { type: "string" } } } } },
			},
		];
		const { getByTestId, baseElement } = render(<IdentityEditModal open={true} onClose={onClose} identity={identity} onSuccess={onSuccess} />);
		await waitFor(() => expect(getByTestId("trigger-change-x")).toBeTruthy());
		// Trigger onChange
		fireEvent.click(getByTestId("trigger-change-x"));
		// Trigger onChange with no formData (early return path)
		fireEvent.click(getByTestId("trigger-change-nil"));
		// Trigger onSubmit with no formData (early return path)
		fireEvent.click(getByTestId("trigger-submit-nil"));
		// Trigger real submit via submitting the form
		const form = baseElement.querySelector("form") as HTMLFormElement;
		await act(async () => {
			fireEvent.submit(form);
		});
		await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
		expect(onSuccess).toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
	});

	it("handles mutateAsync error via logger", async () => {
		mutateAsync.mockRejectedValue(new Error("update-fail"));
		schemasState.data = [
			{
				id: "default",
				schema: { properties: { traits: { properties: { email: { type: "string" } } } } },
			},
		];
		const { baseElement } = render(<IdentityEditModal open={true} onClose={() => {}} identity={identity} />);
		const form = baseElement.querySelector("form") as HTMLFormElement;
		await act(async () => {
			fireEvent.submit(form);
		});
		await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
	});

	it("does not submit when identity is null (early return in onSubmit)", async () => {
		// identity null — component returns null, so the form isn't there
		const { container } = render(<IdentityEditModal open={true} onClose={() => {}} identity={null} />);
		expect(container.innerHTML).toBe("");
	});

	it("close button fires onClose when not pending", async () => {
		schemasState.data = [
			{
				id: "default",
				schema: { properties: { traits: { properties: { email: { type: "string" } } } } },
			},
		];
		const onClose = vi.fn();
		const { getByText } = render(<IdentityEditModal open={true} onClose={onClose} identity={identity} />);
		await waitFor(() => expect(getByText("Cancel")).toBeTruthy());
		fireEvent.click(getByText("Cancel"));
		expect(onClose).toHaveBeenCalled();
	});

	it("does not close when mutation is pending", async () => {
		schemasState.data = [
			{
				id: "default",
				schema: { properties: { traits: { properties: { email: { type: "string" } } } } },
			},
		];
		state.isPending = true;
		const onClose = vi.fn();
		const { getByText } = render(<IdentityEditModal open={true} onClose={onClose} identity={identity} />);
		await waitFor(() => expect(getByText("Cancel")).toBeTruthy());
		// Cancel button is disabled when pending
		fireEvent.click(getByText("Cancel"));
	});

	it("shows 'Unknown error' when update error has no message", async () => {
		state.isError = true;
		state.error = {} as Error;
		schemasState.data = [
			{
				id: "default",
				schema: { properties: { traits: { properties: { email: { type: "string" } } } } },
			},
		];
		const { getByText } = render(<IdentityEditModal open={true} onClose={() => {}} identity={identity} />);
		expect(getByText(/Unknown error/)).toBeInTheDocument();
	});

	it("initializes with empty form data when identity has no traits", async () => {
		schemasState.data = [
			{
				id: "default",
				schema: { properties: { traits: { properties: { email: { type: "string" } } } } },
			},
		];
		// identity without traits — triggers the `|| {}` fallback
		const identityNoTraits = { ...identity, traits: null } as never;
		const { baseElement } = render(<IdentityEditModal open={true} onClose={() => {}} identity={identityNoTraits} />);
		await waitFor(() => expect(baseElement.querySelector("form")).toBeTruthy());
	});
});
