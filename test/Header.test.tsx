import { ThemeProvider } from "@olympusoss/canvas";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Header } from "@/components/layout/Header";

import "./snapshot-setup";

const pushMock = vi.fn();
const logoutMock = vi.fn();
const requestGuardMock = vi.fn();
const isDirtyMock = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/dashboard",
}));

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useUser: () => ({ email: "admin@example.com", displayName: "Admin", role: "admin", kratosIdentityId: "id" }),
	useLogout: () => logoutMock,
}));

vi.mock("@/lib/navGuard", () => ({
	navGuard: {
		isDirty: () => isDirtyMock(),
		requestGuard: (...args: unknown[]) => requestGuardMock(...args),
	},
}));

beforeEach(() => {
	pushMock.mockReset();
	logoutMock.mockReset();
	requestGuardMock.mockReset();
	isDirtyMock.mockReset();
	isDirtyMock.mockReturnValue(false);
});

describe("Header", () => {
	it("matches snapshot", () => {
		const { container } = render(
			<ThemeProvider>
				<Header />
			</ThemeProvider>,
		);
		expect(container).toMatchSnapshot();
	});

	it("renders mobile menu toggle when callback provided and invokes it on click", () => {
		const onMobileMenuToggle = vi.fn();
		const { container } = render(
			<ThemeProvider>
				<Header onMobileMenuToggle={onMobileMenuToggle} />
			</ThemeProvider>,
		);
		const buttons = container.querySelectorAll("button");
		fireEvent.click(buttons[0]);
		expect(onMobileMenuToggle).toHaveBeenCalledTimes(1);
	});

	it("navigates to settings when navGuard is not dirty", () => {
		isDirtyMock.mockReturnValue(false);
		const { getAllByRole } = render(
			<ThemeProvider>
				<Header />
			</ThemeProvider>,
		);
		const buttons = getAllByRole("button");
		// Find settings button (second button, since first may be mobile toggle which is absent)
		const settingsBtn = buttons.find((b) => b.querySelector("svg.lucide-settings")) || buttons[0];
		fireEvent.click(settingsBtn);
		expect(pushMock).toHaveBeenCalledWith("/settings");
		expect(requestGuardMock).not.toHaveBeenCalled();
	});

	it("invokes navGuard when dirty and settings clicked", () => {
		isDirtyMock.mockReturnValue(true);
		const { getAllByRole } = render(
			<ThemeProvider>
				<Header />
			</ThemeProvider>,
		);
		const buttons = getAllByRole("button");
		const settingsBtn = buttons.find((b) => b.querySelector("svg.lucide-settings")) || buttons[0];
		fireEvent.click(settingsBtn);
		expect(requestGuardMock).toHaveBeenCalledWith("/settings");
		expect(pushMock).not.toHaveBeenCalled();
	});

	it("derives page title for recognized segment", () => {
		const { getByText } = render(
			<ThemeProvider>
				<Header />
			</ThemeProvider>,
		);
		expect(getByText("Dashboard")).toBeInTheDocument();
	});
});
