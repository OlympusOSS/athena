import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SessionsTable } from "@/features/sessions/components/SessionsTable";

import "./snapshot-setup";

describe("SessionsTable", () => {
	it("matches snapshot (empty)", () => {
		const { container } = render(<SessionsTable sessions={[]} isLoading={false} isFetchingNextPage={false} searchQuery="" />);
		expect(container).toMatchSnapshot();
	});
});
