import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CreateM2MClientModal } from "@/features/m2m-clients/components/CreateM2MClientModal";

import "./snapshot-setup";

describe("CreateM2MClientModal", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		expect(baseElement).toMatchSnapshot();
	});
});
