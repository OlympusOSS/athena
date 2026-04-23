import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RotateSecretModal } from "@/features/m2m-clients/components/RotateSecretModal";

import "./snapshot-setup";

describe("RotateSecretModal", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(
			<RotateSecretModal open={true} onOpenChange={() => {}} onConfirm={async () => {}} clientName="Test Client" clientId="test-id" />,
		);
		expect(baseElement).toMatchSnapshot();
	});
});
