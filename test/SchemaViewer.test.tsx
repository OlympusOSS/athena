import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SchemaViewer from "@/features/schemas/components/SchemaViewer";

import "./snapshot-setup";

describe("SchemaViewer", () => {
	it("matches snapshot", () => {
		const schema = {
			id: "default",
			schema: {
				$schema: "http://json-schema.org/draft-07/schema#",
				title: "Default Schema",
				type: "object",
				properties: { traits: { type: "object", properties: {} } },
			},
		};
		const { container } = render(<SchemaViewer schema={schema as never} />);
		expect(container).toMatchSnapshot();
	});
});
