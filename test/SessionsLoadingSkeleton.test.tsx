import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SessionsLoadingSkeleton } from "@/features/sessions/components/SessionsLoadingSkeleton";

import "./snapshot-setup";

describe("SessionsLoadingSkeleton", () => {
	it("matches snapshot", () => {
		const { container } = render(<SessionsLoadingSkeleton />);
		expect(container).toMatchSnapshot();
	});
});
