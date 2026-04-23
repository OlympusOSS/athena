import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IdentityDeleteDialog } from "@/features/identities/components/IdentityDeleteDialog";

import "./snapshot-setup";

vi.mock("@/features/identities/hooks/useIdentities", () => ({
	useDeleteIdentity: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
}));

vi.mock("@/lib/demo", () => ({ isDemoIdentity: () => false }));

vi.mock("@/lib/logger", () => ({ uiLogger: { debug: vi.fn(), logError: vi.fn() } }));

describe("IdentityDeleteDialog", () => {
	it("matches snapshot (open)", () => {
		const identity = {
			id: "abc-123-def-456",
			schema_id: "default",
			state: "active",
			traits: { email: "user@example.com", username: "user" },
			created_at: "2024-01-01T00:00:00Z",
			updated_at: "2024-01-01T00:00:00Z",
		} as never;
		const { baseElement } = render(<IdentityDeleteDialog open={true} onClose={() => {}} identity={identity} />);
		expect(baseElement).toMatchSnapshot();
	});
});
