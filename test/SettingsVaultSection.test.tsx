import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsVaultSection } from "@/app/(app)/settings/components/SettingsVaultSection";

import "./snapshot-setup";

describe("SettingsVaultSection", () => {
	beforeEach(() => {
		globalThis.fetch = vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))) as unknown as typeof fetch;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});
	it("matches snapshot (loading)", () => {
		const { container } = render(<SettingsVaultSection />);
		expect(container).toMatchSnapshot();
	});
});
