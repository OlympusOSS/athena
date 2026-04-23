import { fireEvent, render } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { ApiKeyField } from "@/components/forms/ApiKeyField";

import "./snapshot-setup";

function Wrapper({
	hasExistingKey,
	isEditing,
	onEditStart = () => {},
	error,
	helperText,
}: {
	hasExistingKey: boolean;
	isEditing: boolean;
	onEditStart?: () => void;
	error?: string;
	helperText?: string;
}) {
	const { control } = useForm<{ apiKey: string }>({ defaultValues: { apiKey: "" } });
	return (
		<ApiKeyField
			name="apiKey"
			control={control}
			label="API Key"
			hasExistingKey={hasExistingKey}
			isEditing={isEditing}
			onEditStart={onEditStart}
			error={error}
			helperText={helperText}
		/>
	);
}

describe("ApiKeyField", () => {
	it("matches snapshot (editing mode)", () => {
		const { container } = render(<Wrapper hasExistingKey={false} isEditing={true} />);
		expect(container).toMatchSnapshot();
	});

	it("renders masked mode when hasExistingKey=true and not editing", () => {
		const { container } = render(<Wrapper hasExistingKey={true} isEditing={false} />);
		expect(container.textContent).toMatch(/API key is set/);
	});

	it("fires onEditStart when masked edit button clicked", () => {
		const onEditStart = vi.fn();
		const { getByLabelText } = render(<Wrapper hasExistingKey={true} isEditing={false} onEditStart={onEditStart} />);
		fireEvent.click(getByLabelText("edit api key"));
		expect(onEditStart).toHaveBeenCalled();
	});

	it("toggles visibility in edit mode", () => {
		const { container, getByLabelText } = render(<Wrapper hasExistingKey={false} isEditing={true} />);
		const input = container.querySelector("input") as HTMLInputElement;
		expect(input.type).toBe("password");
		fireEvent.click(getByLabelText("toggle api key visibility"));
		expect(input.type).toBe("text");
		fireEvent.click(getByLabelText("toggle api key visibility"));
		expect(input.type).toBe("password");
	});

	it("renders error message", () => {
		const { getByText } = render(<Wrapper hasExistingKey={false} isEditing={true} error="Invalid key" />);
		expect(getByText("Invalid key")).toBeInTheDocument();
	});

	it("renders custom helperText", () => {
		const { getByText } = render(<Wrapper hasExistingKey={false} isEditing={true} helperText="Helper info" />);
		expect(getByText("Helper info")).toBeInTheDocument();
	});
});
