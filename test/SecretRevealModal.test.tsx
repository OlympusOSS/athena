import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SecretRevealModal } from "@/features/m2m-clients/components/SecretRevealModal";

import "./snapshot-setup";

vi.mock("@/hooks", () => ({
	useCopyToClipboard: () => ({ copy: vi.fn(), copiedField: null }),
}));

describe("SecretRevealModal", () => {
	it("matches snapshot (open, creation)", () => {
		const { baseElement } = render(
			<SecretRevealModal open={true} onDone={() => {}} onAbandon={() => {}} clientId="client-xyz" clientSecret="secret-xyz" displayType="creation" />,
		);
		expect(baseElement).toMatchSnapshot();
	});
});
