import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SocialConnectionForm } from "@/app/(app)/social-connections/components/SocialConnectionForm";

import "./snapshot-setup";

vi.mock("@/hooks/useSocialConnections", () => ({
	useCreateSocialConnection: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
		isError: false,
		error: null,
	}),
}));

describe("SocialConnectionForm", () => {
	it("matches snapshot (create)", () => {
		const { container } = render(<SocialConnectionForm mode="create" existingConnection={null} onSuccess={() => {}} onCancel={() => {}} />);
		expect(container).toMatchSnapshot();
	});
});
