import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";

import "./snapshot-setup";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
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
});
