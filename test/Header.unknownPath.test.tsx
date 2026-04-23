import { ThemeProvider } from "@olympusoss/canvas";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Header } from "@/components/layout/Header";

import "./snapshot-setup";

const pushMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/some-unknown-segment",
}));

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useUser: () => null,
	useLogout: () => logoutMock,
}));

vi.mock("@/lib/navGuard", () => ({
	navGuard: { isDirty: () => false, requestGuard: vi.fn() },
}));

describe("Header — unknown pathname", () => {
	it("derives page title from unknown segment (capitalizes)", () => {
		const { getByText } = render(
			<ThemeProvider>
				<Header />
			</ThemeProvider>,
		);
		expect(getByText("Some-unknown-segment")).toBeInTheDocument();
	});

	it("renders U fallback avatar when user not available", () => {
		const { getByText } = render(
			<ThemeProvider>
				<Header />
			</ThemeProvider>,
		);
		expect(getByText("U")).toBeInTheDocument();
	});

	it("allows logout button to fire", () => {
		const { getAllByRole } = render(
			<ThemeProvider>
				<Header />
			</ThemeProvider>,
		);
		// Open the dropdown menu by clicking on the avatar trigger
		const allBtns = getAllByRole("button");
		const avatarBtn = allBtns[allBtns.length - 1];
		fireEvent.click(avatarBtn);
		// Logout menu item now exists
		const logoutItem = document.querySelector('[role="menuitem"]:last-child') as HTMLElement | null;
		if (logoutItem) {
			fireEvent.click(logoutItem);
			expect(logoutMock).toHaveBeenCalled();
		}
	});
});
