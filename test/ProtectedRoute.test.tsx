import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";

import "./snapshot-setup";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/",
}));

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useIsAuthenticated: () => true,
	useHasPermission: () => () => true,
}));

describe("ProtectedRoute", () => {
	it("matches snapshot (authenticated)", () => {
		const { container } = render(
			<ProtectedRoute>
				<div>child</div>
			</ProtectedRoute>,
		);
		expect(container).toMatchSnapshot();
	});

	it("renders children when no requiredRole provided", () => {
		const { getByText } = render(
			<ProtectedRoute>
				<div>child-content</div>
			</ProtectedRoute>,
		);
		expect(getByText("child-content")).toBeInTheDocument();
	});

	it("renders children when user has required permission", async () => {
		const { UserRole } = await import("@/features/auth");
		const { getByText } = render(
			<ProtectedRoute requiredRole={UserRole.VIEWER}>
				<div>perm-ok</div>
			</ProtectedRoute>,
		);
		expect(getByText("perm-ok")).toBeInTheDocument();
	});
});
