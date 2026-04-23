import { render } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { ServiceConfigSection } from "@/app/(app)/settings/components/ServiceConfigSection";
import type { ServiceEndpointsForm } from "@/app/(app)/settings/hooks";

import "./snapshot-setup";

function Wrapper() {
	const form = useForm<ServiceEndpointsForm>({
		defaultValues: { publicUrl: "", adminUrl: "", apiKey: "" },
	});
	return (
		<ServiceConfigSection
			serviceName="Kratos"
			form={form}
			currentEndpoints={{ publicUrl: "", adminUrl: "", apiKey: "" }}
			publicUrlPlaceholder="https://kratos.example.com"
			adminUrlPlaceholder="https://kratos-admin.example.com"
			publicUrlHelperText="Public URL"
			adminUrlHelperText="Admin URL"
			onSave={async () => {}}
			validateUrl={() => true}
			isEditingApiKey={false}
			onApiKeyEditStart={() => {}}
		/>
	);
}

describe("ServiceConfigSection", () => {
	it("matches snapshot", () => {
		const { container } = render(<Wrapper />);
		expect(container).toMatchSnapshot();
	});
});
