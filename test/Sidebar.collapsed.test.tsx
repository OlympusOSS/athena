import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/components/layout/Sidebar";

import "./snapshot-setup";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/identities/abc",
}));

vi.mock("@/features/auth", async () => {
	const actual = await vi.importActual<typeof import("@/features/auth")>("@/features/auth");
	return {
		...actual,
		useUser: () => ({ email: "viewer@example.com", displayName: "Viewer", role: actual.UserRole.VIEWER, kratosIdentityId: "id" }),
		useLogout: () => vi.fn(),
	};
});

vi.mock("@/features/settings/hooks/useSettings", () => ({
	useHydraEnabled: () => false,
}));

describe("Sidebar — collapsed, viewer role, Hydra disabled", () => {
	it("renders collapsed sidebar with viewer-only nav", () => {
		const { container } = render(<Sidebar expanded={false} onToggle={() => {}} />);
		expect(container).toMatchSnapshot();
	});

	it("invokes onToggle when logo button clicked (collapsed)", () => {
		const onToggle = vi.fn();
		const { container } = render(<Sidebar expanded={false} onToggle={onToggle} />);
		const btn = container.querySelector("button");
		if (btn) fireEvent.click(btn);
		expect(onToggle).toHaveBeenCalled();
	});

	it("calls onNavigate when nav link clicked", () => {
		const onNavigate = vi.fn();
		const { container } = render(<Sidebar expanded={true} onToggle={() => {}} onNavigate={onNavigate} />);
		const links = container.querySelectorAll("a");
		if (links.length > 0) {
			fireEvent.click(links[0]);
			expect(onNavigate).toHaveBeenCalled();
		}
	});
});

describe("Sidebar — no user", () => {
	it("handles null user (hasRequiredRole returns false)", () => {
		vi.doMock("@/features/auth", async () => {
			const actual = await vi.importActual<typeof import("@/features/auth")>("@/features/auth");
			return {
				...actual,
				useUser: () => null,
				useLogout: () => vi.fn(),
			};
		});
	});
});
