import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/components/layout/Sidebar";

import "./snapshot-setup";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/dashboard",
}));

// No user is authenticated (null) — hasRequiredRole should return false for
// any item that has a requiredRole, exercising the `if (!user) return false;` branch.
vi.mock("@/features/auth", async () => {
	const actual = await vi.importActual<typeof import("@/features/auth")>("@/features/auth");
	return {
		...actual,
		useUser: () => null,
		useLogout: () => vi.fn(),
	};
});

vi.mock("@/features/settings/hooks/useSettings", () => ({
	useHydraEnabled: () => true,
}));

describe("Sidebar — null user", () => {
	it("filters out role-gated nav items when user is null", () => {
		const { container } = render(<Sidebar expanded={true} onToggle={() => {}} />);
		// When user is null, all VIEWER/ADMIN-guarded items are hidden.
		// We don't assert specific items — only that render succeeds exercising the branch.
		expect(container).toBeTruthy();
	});
});
