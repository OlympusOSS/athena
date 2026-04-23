import { ThemeProvider } from "@olympusoss/canvas";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Header } from "@/components/layout/Header";

import "./snapshot-setup";

const logoutMock = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	// Path "/" → filter(Boolean)[0] is undefined → hits the `|| ""` branch
	usePathname: () => "/",
}));

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useUser: () => null,
	useLogout: () => logoutMock,
}));

vi.mock("@/lib/navGuard", () => ({
	navGuard: { isDirty: () => false, requestGuard: vi.fn() },
}));

describe("Header — root pathname", () => {
	it("exercises empty segment branch (pathname='/') — renders empty title", () => {
		const { container } = render(
			<ThemeProvider>
				<Header />
			</ThemeProvider>,
		);
		// Title span is empty because filter(Boolean)[0] is undefined → "|| ''" branch
		const titleSpan = container.querySelector("span.text-sm.font-medium");
		expect(titleSpan?.textContent).toBe("");
	});
});
