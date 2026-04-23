import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TelWidget } from "@/features/identities/components/shared-form-widgets";

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
});
