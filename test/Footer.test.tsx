import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Footer } from "@/components/layout/Footer";

import "./snapshot-setup";

describe("Footer", () => {
	it("matches snapshot", () => {
		const { container } = render(<Footer />);
		expect(container).toMatchSnapshot();
	});
});
