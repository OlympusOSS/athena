import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OAuthConfigSection } from "@/app/(app)/settings/components/OAuthConfigSection";

import "./snapshot-setup";

describe("OAuthConfigSection", () => {
	beforeEach(() => {
		globalThis.fetch = vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))) as unknown as typeof fetch;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});
	it("matches snapshot (loading)", () => {
		const { container } = render(<OAuthConfigSection />);
		expect(container).toMatchSnapshot();
	});
});
