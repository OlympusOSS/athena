import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LockedAccountsTable } from "@/features/security/components/LockedAccountsTable";

import "./snapshot-setup";

vi.mock("@/features/security/hooks/useLockedAccounts", () => ({
	useUnlockAccount: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("LockedAccountsTable", () => {
	it("matches snapshot (empty)", () => {
		const { container } = render(<LockedAccountsTable accounts={[]} isLoading={false} />);
		expect(container).toMatchSnapshot();
	});
});
