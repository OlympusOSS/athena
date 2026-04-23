import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SchemaList from "@/features/schemas/components/SchemaList";

import "./snapshot-setup";

describe("SchemaList", () => {
	it("matches snapshot (empty)", () => {
		const { container } = render(<SchemaList schemas={[]} loading={false} onSchemaSelect={() => {}} />);
		expect(container).toMatchSnapshot();
	});

	it("shows loading state", () => {
		const { container } = render(<SchemaList schemas={[]} loading={true} onSchemaSelect={() => {}} />);
		expect(container.textContent).toMatch(/Loading schemas/);
	});

	it("renders schemas and fires onSchemaSelect", () => {
		const onSchemaSelect = vi.fn();
		const schemas = [
			{
				id: "default",
				schema: {
					title: "Person",
					properties: { traits: { properties: { email: { type: "string" } } } },
				},
			},
			{
				id: "other-id",
				schema: {
					title: "Company",
					properties: { traits: { properties: { name: { type: "string" } } } },
				},
			},
		];
		const { container, getByText } = render(<SchemaList schemas={schemas as never[]} loading={false} onSchemaSelect={onSchemaSelect} />);
		expect(getByText("Default")).toBeInTheDocument();
		const buttons = container.querySelectorAll("button");
		fireEvent.click(buttons[0]);
		expect(onSchemaSelect).toHaveBeenCalledWith(schemas[0]);
	});
});
