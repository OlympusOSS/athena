import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { convertKratosSchemaToRJSF, createUISchema, TelWidget } from "@/features/identities/components/shared-form-widgets";

import "./snapshot-setup";

describe("shared-form-widgets", () => {
	it("TelWidget matches snapshot", () => {
		const { container } = render(
			<TelWidget
				id="phone"
				value=""
				onChange={() => {}}
				label="Phone"
				placeholder="Enter phone"
				disabled={false}
				readonly={false}
				required={false}
				name="phone"
				schema={{} as never}
				options={{} as never}
				registry={{} as never}
				onBlur={() => {}}
				onFocus={() => {}}
			/>,
		);
		expect(container).toMatchSnapshot();
	});

	it("TelWidget invokes onChange when phone input changes", () => {
		const onChange = vi.fn();
		const { container } = render(
			<TelWidget
				id="phone"
				value=""
				onChange={onChange}
				label="Phone"
				placeholder="Enter phone"
				disabled={false}
				readonly={false}
				required={false}
				name="phone"
				schema={{} as never}
				options={{} as never}
				registry={{} as never}
				onBlur={() => {}}
				onFocus={() => {}}
			/>,
		);
		const input = container.querySelector("input");
		if (input) {
			fireEvent.change(input, { target: { value: "+15555551234" } });
			expect(onChange).toHaveBeenCalled();
		}
	});

	it("convertKratosSchemaToRJSF extracts traits sub-schema", () => {
		const kratosSchema = {
			properties: {
				traits: {
					type: "object",
					properties: { email: { type: "string", format: "email" } },
					required: ["email"],
				},
			},
		};
		const result = convertKratosSchemaToRJSF(kratosSchema);
		expect(result).toEqual({
			title: "Identity Traits",
			type: "object",
			properties: { email: { type: "string", format: "email" } },
			required: ["email"],
		});
	});

	it("convertKratosSchemaToRJSF returns empty traits when no traits property", () => {
		expect(convertKratosSchemaToRJSF({})).toEqual({
			title: "Identity Traits",
			type: "object",
			properties: {},
		});
	});

	it("convertKratosSchemaToRJSF uses [] when required missing", () => {
		const kratosSchema = {
			properties: {
				traits: {
					type: "object",
					properties: {},
				},
			},
		};
		const result = convertKratosSchemaToRJSF(kratosSchema);
		expect(result.required).toEqual([]);
	});

	it("createUISchema maps email format", () => {
		const schema = { properties: { email: { type: "string", format: "email" } } };
		const ui = createUISchema(schema);
		expect(ui.email).toEqual({ "ui:widget": "email" });
	});

	it("createUISchema maps tel format", () => {
		const schema = { properties: { phone: { type: "string", format: "tel" } } };
		const ui = createUISchema(schema);
		expect(ui.phone).toEqual({ "ui:widget": "tel" });
	});

	it("createUISchema maps nested object fields", () => {
		const schema = { properties: { address: { type: "object", properties: { street: { type: "string" } } } } };
		const ui = createUISchema(schema);
		expect(ui.address).toEqual({ "ui:field": "object" });
	});

	it("createUISchema returns empty object when no properties", () => {
		expect(createUISchema({})).toEqual({});
	});
});
