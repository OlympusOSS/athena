import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SmtpConfigSection } from "@/app/(app)/settings/components/SmtpConfigSection";

import "./snapshot-setup";

describe("SmtpConfigSection", () => {
	beforeEach(() => {
		globalThis.fetch = vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))) as unknown as typeof fetch;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});
	it("matches snapshot (loading)", () => {
		const { container } = render(<SmtpConfigSection />);
		expect(container).toMatchSnapshot();
	});
});
