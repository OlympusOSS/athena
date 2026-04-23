import { ThemeProvider } from "@olympusoss/canvas";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Header } from "@/components/layout/Header";

import "./snapshot-setup";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/dashboard",
}));

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useUser: () => ({ email: "admin@example.com", displayName: "Admin", role: "admin", kratosIdentityId: "id" }),
	useLogout: () => vi.fn(),
}));

vi.mock("@/lib/navGuard", () => ({
	navGuard: { isDirty: () => false, requestGuard: vi.fn() },
}));

describe("Header", () => {
	it("matches snapshot", () => {
		const { container } = render(
			<ThemeProvider>
				<Header />
			</ThemeProvider>,
		);
		expect(container).toMatchSnapshot();
	});
});
