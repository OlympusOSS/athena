import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IdentityEditModal } from "@/features/identities/components/IdentityEditModal";

import "./snapshot-setup";

vi.mock("@/features/identities/hooks/useIdentities", () => ({
	useUpdateIdentity: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
		isError: false,
		error: null,
	}),
}));

vi.mock("@/features/schemas/hooks/useSchemas", () => ({
	useSchemas: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/lib/logger", () => ({ uiLogger: { debug: vi.fn(), logError: vi.fn() } }));

describe("IdentityEditModal", () => {
	it("matches snapshot (open)", () => {
		const identity = {
			id: "abc-123-def-456",
			schema_id: "default",
			state: "active",
			traits: { email: "user@example.com" },
			created_at: "2024-01-01T00:00:00Z",
			updated_at: "2024-01-01T00:00:00Z",
		} as never;
		const { baseElement } = render(<IdentityEditModal open={true} onClose={() => {}} identity={identity} />);
		expect(baseElement).toMatchSnapshot();
	});
});
