import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeleteM2MClientModal } from "@/features/m2m-clients/components/DeleteM2MClientModal";

import "./snapshot-setup";

describe("DeleteM2MClientModal", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(
			<DeleteM2MClientModal open={true} onOpenChange={() => {}} onConfirm={async () => {}} clientName="Test Client" clientId="test-id" />,
		);
		expect(baseElement).toMatchSnapshot();
	});
});
