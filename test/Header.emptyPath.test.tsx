import { ThemeProvider } from "@olympusoss/canvas";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Header } from "@/components/layout/Header";

import "./snapshot-setup";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => null,
}));

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useUser: () => null,
	useLogout: () => vi.fn(),
}));

vi.mock("@/lib/navGuard", () => ({
	navGuard: { isDirty: () => false, requestGuard: vi.fn() },
}));

describe("Header — null pathname", () => {
	it("returns empty title when pathname is null", () => {
		const { container } = render(
			<ThemeProvider>
				<Header />
			</ThemeProvider>,
		);
		// The title span is there but empty
		expect(container).toMatchSnapshot();
	});
});
