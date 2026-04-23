import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/components/layout/Sidebar";

import "./snapshot-setup";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/dashboard",
}));

const logoutMock = vi.fn();

vi.mock("@/features/auth", async () => {
	const actual = await vi.importActual<typeof import("@/features/auth")>("@/features/auth");
	return {
		...actual,
		useUser: () => ({ email: "admin@example.com", displayName: "Admin", role: actual.UserRole.ADMIN, kratosIdentityId: "id" }),
		useLogout: () => logoutMock,
	};
});

vi.mock("@/features/settings/hooks/useSettings", () => ({
	useHydraEnabled: () => true,
}));

describe("Sidebar", () => {
	it("matches snapshot (expanded)", () => {
		const { container } = render(<Sidebar expanded={true} onToggle={() => {}} />);
		expect(container).toMatchSnapshot();
	});

	it("calls onToggle when panel toggle button is clicked (expanded)", () => {
		const onToggle = vi.fn();
		const { container } = render(<Sidebar expanded={true} onToggle={onToggle} />);
		const toggleBtn = container.querySelector("button[type='button']");
		if (toggleBtn) fireEvent.click(toggleBtn);
		expect(onToggle).toHaveBeenCalled();
	});

	it("calls logout on logout button click", () => {
		logoutMock.mockReset();
		const { getAllByRole } = render(<Sidebar expanded={true} onToggle={() => {}} />);
		const buttons = getAllByRole("button");
		// Logout is last button in footer
		fireEvent.click(buttons[buttons.length - 1]);
		expect(logoutMock).toHaveBeenCalled();
	});
});
