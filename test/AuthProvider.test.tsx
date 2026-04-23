import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/providers/AuthProvider";

import "./snapshot-setup";

const checkSessionMock = vi.fn();
const pushMock = vi.fn();
const pathnameState = { current: "/dashboard" };
const authState: {
	isAuthenticated: boolean;
	isLoading: boolean;
} = { isAuthenticated: true, isLoading: false };

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => pathnameState.current,
}));

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useIsAuthenticated: () => authState.isAuthenticated,
	useIsAuthLoading: () => authState.isLoading,
	useCheckSession: () => checkSessionMock,
}));

beforeEach(() => {
	checkSessionMock.mockReset();
	pushMock.mockReset();
	pathnameState.current = "/dashboard";
	authState.isAuthenticated = true;
	authState.isLoading = false;
});

describe("AuthProvider", () => {
	it("shows loading spinner while isLoading is true", () => {
		authState.isLoading = true;
		const { container } = render(
			<AuthProvider>
				<div>kids</div>
			</AuthProvider>,
		);
		expect(container.querySelector("svg.animate-spin, svg.lucide-loader-circle")).toBeTruthy();
	});

	it("renders children when authenticated and not loading", () => {
		authState.isAuthenticated = true;
		authState.isLoading = false;
		const { getByText } = render(
			<AuthProvider>
				<div>authed-content</div>
			</AuthProvider>,
		);
		expect(getByText("authed-content")).toBeInTheDocument();
	});

	it("redirects to /dashboard when authenticated on /login", () => {
		pathnameState.current = "/login";
		authState.isAuthenticated = true;
		authState.isLoading = false;
		render(
			<AuthProvider>
				<div>x</div>
			</AuthProvider>,
		);
		expect(pushMock).toHaveBeenCalledWith("/dashboard");
	});

	it("redirects to /api/auth/login when unauthenticated and not on /login", () => {
		pathnameState.current = "/dashboard";
		authState.isAuthenticated = false;
		authState.isLoading = false;
		const originalLocation = window.location;
		// @ts-expect-error - jsdom allows this
		delete window.location;
		(window as unknown as { location: { href: string } }).location = { href: "" } as Location;
		render(
			<AuthProvider>
				<div>x</div>
			</AuthProvider>,
		);
		expect(window.location.href).toBe("/api/auth/login");
		// Restore
		(window as unknown as { location: Location }).location = originalLocation;
	});

	it("calls checkSession on mount (once)", () => {
		render(
			<AuthProvider>
				<div>x</div>
			</AuthProvider>,
		);
		expect(checkSessionMock).toHaveBeenCalledTimes(1);
	});
});
