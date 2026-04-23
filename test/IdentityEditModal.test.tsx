import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IdentityEditModal } from "@/features/identities/components/IdentityEditModal";

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

const identity = {
	id: "abc-123-def-456",
	schema_id: "default",
	state: "active",
	traits: { email: "user@example.com" },
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

describe("IdentityEditModal", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(<IdentityEditModal open={true} onClose={() => {}} identity={identity} />);
		expect(baseElement).toMatchSnapshot();
	});

	it("returns null when identity is null", () => {
		const { container } = render(<IdentityEditModal open={true} onClose={() => {}} identity={null} />);
		expect(container.innerHTML).toBe("");
	});

	it("shows loading icon while schemas loading", () => {
		schemasState.isLoading = true;
		const { baseElement } = render(<IdentityEditModal open={true} onClose={() => {}} identity={identity} />);
		expect(baseElement.querySelector(".lucide-loader-circle")).toBeTruthy();
	});

	it("shows 'schema not found' alert when no matching schema", () => {
		schemasState.data = [{ id: "other-schema", schema: {} }];
		const { getByText } = render(<IdentityEditModal open={true} onClose={() => {}} identity={identity} />);
		expect(getByText(/Schema not found/)).toBeInTheDocument();
	});

	it("renders form when matching schema loaded", () => {
		schemasState.data = [
			{
				id: "default",
				schema: {
					properties: {
						traits: {
							type: "object",
							properties: { email: { type: "string" } },
						},
					},
				},
			},
		];
		const { baseElement } = render(<IdentityEditModal open={true} onClose={() => {}} identity={identity} />);
		// Schema form renders the Save button
		expect(baseElement.textContent).toMatch(/Save Changes|Cancel/);
	});

	it("shows error alert when update errored", () => {
		state.isError = true;
		state.error = new Error("update failed");
		const { getByText } = render(<IdentityEditModal open={true} onClose={() => {}} identity={identity} />);
		expect(getByText(/Failed to update identity: update failed/)).toBeInTheDocument();
	});
});
