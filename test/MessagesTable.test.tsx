import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessagesTable } from "@/features/messages/components/MessagesTable";

import "./snapshot-setup";

describe("MessagesTable", () => {
	it("matches snapshot (empty)", () => {
		const { container } = render(<MessagesTable messages={[]} isLoading={false} />);
		expect(container).toMatchSnapshot();
	});
});
