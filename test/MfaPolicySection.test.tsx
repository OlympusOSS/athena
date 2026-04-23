import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MfaPolicySection } from "@/app/(app)/settings/components/MfaPolicySection";

import "./snapshot-setup";

describe("MfaPolicySection", () => {
	beforeEach(() => {
		globalThis.fetch = vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))) as unknown as typeof fetch;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});
	it("matches snapshot (loading)", () => {
		const { container } = render(<MfaPolicySection />);
		expect(container).toMatchSnapshot();
	});
});
