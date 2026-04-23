import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UserRole } from "@/features/auth";
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
	useHasPermission: () => () => false,
}));

describe("ProtectedRoute — permission denied", () => {
	it("redirects to /dashboard when required role mismatch", () => {
		pushMock.mockReset();
		render(
			<ProtectedRoute requiredRole={UserRole.ADMIN}>
				<div>should-not-show</div>
			</ProtectedRoute>,
		);
		expect(pushMock).toHaveBeenCalledWith("/dashboard");
	});

	it("renders nothing when no permission (returns null)", () => {
		const { container } = render(
			<ProtectedRoute requiredRole={UserRole.ADMIN}>
				<div>hidden</div>
			</ProtectedRoute>,
		);
		expect(container.innerHTML).toBe("");
	});
});
