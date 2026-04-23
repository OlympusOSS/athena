import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Providers from "@/providers/Providers";

import "./snapshot-setup";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => "/dashboard",
}));

vi.mock("@/components/SettingsInitializer", () => ({
	SettingsInitializer: () => null,
}));

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useIsAuthenticated: () => true,
	useIsAuthLoading: () => false,
	useCheckSession: () => vi.fn(),
}));

describe("Providers", () => {
	it("renders children wrapped in all providers", () => {
		const { getByText } = render(
			<Providers>
				<div>app-child</div>
			</Providers>,
		);
		expect(getByText("app-child")).toBeInTheDocument();
	});
});
