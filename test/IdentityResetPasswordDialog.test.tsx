import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IdentityResetPasswordDialog } from "@/features/identities/components/IdentityResetPasswordDialog";

import "./snapshot-setup";

vi.mock("@/features/identities/hooks/useIdentities", () => ({
	useResetIdentityPassword: () => ({
		mutate: vi.fn(),
		reset: vi.fn(),
		isPending: false,
		isError: false,
		error: null,
	}),
}));

vi.mock("@/lib/demo", () => ({ isDemoIdentity: () => false }));

describe("IdentityResetPasswordDialog", () => {
	it("matches snapshot (open)", () => {
		const identity = {
			id: "abc-123-def-456",
			schema_id: "default",
			state: "active",
			traits: { email: "user@example.com" },
			created_at: "2024-01-01T00:00:00Z",
			updated_at: "2024-01-01T00:00:00Z",
		} as never;
		const { baseElement } = render(<IdentityResetPasswordDialog open={true} onClose={() => {}} identity={identity} />);
		expect(baseElement).toMatchSnapshot();
	});
});
