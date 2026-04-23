import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GeoConfigSection } from "@/app/(app)/settings/components/GeoConfigSection";

import "./snapshot-setup";

describe("GeoConfigSection", () => {
	beforeEach(() => {
		globalThis.fetch = vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))) as unknown as typeof fetch;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});
	it("matches snapshot (loading)", () => {
		const { container } = render(<GeoConfigSection />);
		expect(container).toMatchSnapshot();
	});
});
