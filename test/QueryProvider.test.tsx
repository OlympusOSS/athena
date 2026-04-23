import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QueryProvider } from "@/providers/QueryProvider";

import "./snapshot-setup";

describe("QueryProvider", () => {
	it("renders children inside QueryClientProvider", () => {
		const { getByText } = render(
			<QueryProvider>
				<div>query-child</div>
			</QueryProvider>,
		);
		expect(getByText("query-child")).toBeInTheDocument();
	});
});
