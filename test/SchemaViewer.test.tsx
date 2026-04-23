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

	it("shows loading state", () => {
		const { container } = render(<SchemaViewer schema={{ id: "x" } as never} loading={true} />);
		expect(container.textContent).toMatch(/Loading schema details/);
	});

	it("parses string schema JSON", () => {
		const schemaString = JSON.stringify({
			title: "Parsed",
			type: "object",
			properties: { traits: { type: "object", properties: { email: {} } } },
		});
		const schema = { id: "id", schema: schemaString };
		const { container } = render(<SchemaViewer schema={schema as never} />);
		expect(container.textContent).toMatch(/email/);
	});
});
