import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { ServiceConfigSection } from "@/app/(app)/settings/components/ServiceConfigSection";
import type { ServiceEndpointsForm } from "@/app/(app)/settings/hooks";

import "./snapshot-setup";

function Wrapper({
	serviceName = "Kratos" as "Kratos" | "Hydra",
	defaultValues = { publicUrl: "", adminUrl: "", apiKey: "" },
	onSave = vi.fn(),
	validateUrl = () => true as true,
	isEditingApiKey = false,
	currentEndpoints = { publicUrl: "", adminUrl: "", apiKey: "" },
	showDivider = false,
}: {
	serviceName?: "Kratos" | "Hydra";
	defaultValues?: ServiceEndpointsForm;
	onSave?: (data: ServiceEndpointsForm) => Promise<void>;
	validateUrl?: (url: string) => string | true;
	isEditingApiKey?: boolean;
	currentEndpoints?: { publicUrl: string; adminUrl: string; apiKey: string };
	showDivider?: boolean;
}) {
	const form = useForm<ServiceEndpointsForm>({ defaultValues });
	return (
		<ServiceConfigSection
			serviceName={serviceName}
			form={form}
			currentEndpoints={currentEndpoints}
			publicUrlPlaceholder="https://public.example.com"
			adminUrlPlaceholder="https://admin.example.com"
			publicUrlHelperText="Public URL"
			adminUrlHelperText="Admin URL"
			onSave={onSave}
			validateUrl={validateUrl}
			isEditingApiKey={isEditingApiKey}
			onApiKeyEditStart={() => {}}
			showDivider={showDivider}
		/>
	);
}

describe("ServiceConfigSection", () => {
	it("matches snapshot", () => {
		const { container } = render(<Wrapper />);
		expect(container).toMatchSnapshot();
	});

	it("renders Hydra service variant with divider", () => {
		const { getAllByText } = render(<Wrapper serviceName="Hydra" showDivider={true} />);
		expect(getAllByText(/OAuth2 Service/).length).toBeGreaterThan(0);
	});

	it("submits valid data on save", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { container, getByText } = render(
			<Wrapper
				onSave={onSave}
				defaultValues={{ publicUrl: "https://a.example.com", adminUrl: "https://b.example.com", apiKey: "x" }}
				isEditingApiKey={true}
			/>,
		);
		// Modify to trigger isDirty
		const publicInput = container.querySelector("#Kratos-publicUrl") as HTMLInputElement;
		fireEvent.change(publicInput, { target: { value: "https://new.example.com" } });
		const btn = getByText(/Save Identity Service Settings/);
		await act(async () => {
			fireEvent.click(btn);
		});
		await waitFor(() => expect(onSave).toHaveBeenCalled());
	});

	it("shows validation error messages", async () => {
		const validate = vi.fn().mockReturnValue("Invalid URL");
		const { container, getByText } = render(<Wrapper validateUrl={validate} isEditingApiKey={true} />);
		const publicInput = container.querySelector("#Kratos-publicUrl") as HTMLInputElement;
		fireEvent.change(publicInput, { target: { value: "xx" } });
		const btn = getByText(/Save Identity Service Settings/);
		await act(async () => {
			fireEvent.click(btn);
		});
		await waitFor(() => expect(container.textContent).toMatch(/Invalid URL/));
	});

	it("renders 'Configured' badge when current api key exists", () => {
		const { getByText } = render(<Wrapper currentEndpoints={{ publicUrl: "", adminUrl: "", apiKey: "ory_pat_abc" }} />);
		expect(getByText(/Configured/)).toBeInTheDocument();
	});
});
