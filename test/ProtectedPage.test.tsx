import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProtectedPage } from "@/components/layout/ProtectedPage";

import "./snapshot-setup";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/dashboard",
}));

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useIsAuthenticated: () => true,
	useHasPermission: () => () => true,
	useUser: () => ({ email: "admin@example.com", displayName: "Admin", role: "admin", kratosIdentityId: "id" }),
	useLogout: () => vi.fn(),
}));

vi.mock("@/features/settings/hooks/useSettings", () => ({
	useHydraEnabled: () => true,
}));

vi.mock("@/lib/navGuard", () => ({
	navGuard: { isDirty: () => false, requestGuard: vi.fn() },
}));

describe("ProtectedPage", () => {
	it("matches snapshot (no layout)", () => {
		const { container } = render(
			<ProtectedPage layout={false}>
				<div>content</div>
			</ProtectedPage>,
		);
		expect(container).toMatchSnapshot();
	});
});
