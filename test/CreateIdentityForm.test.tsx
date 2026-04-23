import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CreateIdentityForm from "@/features/identities/components/CreateIdentityForm";

import "./snapshot-setup";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/features/identities/hooks/useIdentities", () => ({
	useCreateIdentity: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
		isError: false,
		error: null,
	}),
}));

vi.mock("@/features/schemas/hooks/useSchemas", () => ({
	useSchemas: () => ({ data: [], isLoading: false }),
}));

describe("CreateIdentityForm", () => {
	it("matches snapshot", () => {
		const { container } = render(<CreateIdentityForm />);
		expect(container).toMatchSnapshot();
	});
});
