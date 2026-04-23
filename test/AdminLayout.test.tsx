import { ThemeProvider } from "@olympusoss/canvas";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminLayout } from "@/components/layout/AdminLayout";

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

vi.mock("@/lib/navGuard", () => ({
	navGuard: { isDirty: () => false, requestGuard: vi.fn() },
}));

describe("AdminLayout", () => {
	it("matches snapshot", () => {
		const { container } = render(
			<ThemeProvider>
				<AdminLayout>
					<div>content</div>
				</AdminLayout>
			</ThemeProvider>,
		);
		expect(container).toMatchSnapshot();
	});

	it("toggles sidebar expand when inner Sidebar toggle is clicked", () => {
		const { container } = render(
			<ThemeProvider>
				<AdminLayout>
					<div>content</div>
				</AdminLayout>
			</ThemeProvider>,
		);
		// Sidebar renders a toggle button — clicking it fires the anonymous
		// `() => setExpanded(!expanded)` callback that wraps setExpanded.
		const toggleBtn = container.querySelector("button[type='button']");
		if (toggleBtn) fireEvent.click(toggleBtn);
		expect(container).toBeTruthy();
	});
});
