import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CredentialDeleteDialog } from "@/features/identities/components/CredentialDeleteDialog";

import "./snapshot-setup";

vi.mock("@/features/identities/hooks/useIdentities", () => ({
	useDeleteIdentityCredentials: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
		isError: false,
		error: null,
	}),
}));

vi.mock("@/lib/logger", () => ({ uiLogger: { debug: vi.fn(), logError: vi.fn() } }));

describe("CredentialDeleteDialog", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(<CredentialDeleteDialog open={true} onClose={() => {}} identityId="abc-123" credentialType="password" />);
		expect(baseElement).toMatchSnapshot();
	});
});
