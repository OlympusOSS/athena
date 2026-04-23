import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeleteConnectionDialog } from "@/app/(app)/social-connections/components/DeleteConnectionDialog";

import "./snapshot-setup";

vi.mock("@/hooks/useSocialConnections", () => ({
	useDeleteSocialConnection: () => ({
		mutate: vi.fn(),
		isPending: false,
		isError: false,
		error: null,
	}),
}));

describe("DeleteConnectionDialog", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(<DeleteConnectionDialog open={true} provider="google" onSuccess={() => {}} onCancel={() => {}} />);
		expect(baseElement).toMatchSnapshot();
	});
});
