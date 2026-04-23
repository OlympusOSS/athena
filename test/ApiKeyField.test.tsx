import { render } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { ApiKeyField } from "@/components/forms/ApiKeyField";

import "./snapshot-setup";

function Wrapper({ hasExistingKey, isEditing }: { hasExistingKey: boolean; isEditing: boolean }) {
	const { control } = useForm<{ apiKey: string }>({ defaultValues: { apiKey: "" } });
	return <ApiKeyField name="apiKey" control={control} label="API Key" hasExistingKey={hasExistingKey} isEditing={isEditing} onEditStart={() => {}} />;
}

describe("ApiKeyField", () => {
	it("matches snapshot (editing mode)", () => {
		const { container } = render(<Wrapper hasExistingKey={false} isEditing={true} />);
		expect(container).toMatchSnapshot();
	});
});
