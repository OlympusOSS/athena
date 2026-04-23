import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SchemaList from "@/features/schemas/components/SchemaList";

import "./snapshot-setup";

describe("SchemaList", () => {
	it("matches snapshot (empty)", () => {
		const { container } = render(<SchemaList schemas={[]} loading={false} onSchemaSelect={() => {}} />);
		expect(container).toMatchSnapshot();
	});
});
