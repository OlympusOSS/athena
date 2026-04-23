import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/components/layout/Sidebar";

import "./snapshot-setup";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/dashboard",
}));

vi.mock("@/features/auth", async () => {
	const actual = await vi.importActual<typeof import("@/features/auth")>("@/features/auth");
	return {
		...actual,
		useUser: () => ({ email: "admin@example.com", displayName: "Admin", role: actual.UserRole.ADMIN, kratosIdentityId: "id" }),
		useLogout: () => vi.fn(),
	};
});

vi.mock("@/features/settings/hooks/useSettings", () => ({
	useHydraEnabled: () => true,
}));

describe("Sidebar", () => {
	it("matches snapshot (expanded)", () => {
		const { container } = render(<Sidebar expanded={true} onToggle={() => {}} />);
		expect(container).toMatchSnapshot();
	});
});
