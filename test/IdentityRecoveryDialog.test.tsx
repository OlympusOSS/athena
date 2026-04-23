import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IdentityRecoveryDialog } from "@/features/identities/components/IdentityRecoveryDialog";

import "./snapshot-setup";

vi.mock("@/services/kratos", () => ({
	createRecoveryLink: vi.fn(async () => ({ data: { recovery_link: "" } })),
}));

vi.mock("@/lib/demo", () => ({ isDemoIdentity: () => false }));

describe("IdentityRecoveryDialog", () => {
	it("matches snapshot (open)", () => {
		const identity = {
			id: "abc-123-def-456",
			schema_id: "default",
			state: "active",
			traits: { email: "user@example.com" },
			created_at: "2024-01-01T00:00:00Z",
			updated_at: "2024-01-01T00:00:00Z",
		} as never;
		const { baseElement } = render(<IdentityRecoveryDialog open={true} onClose={() => {}} identity={identity} />);
		expect(baseElement).toMatchSnapshot();
	});
});
