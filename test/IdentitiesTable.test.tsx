import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import IdentitiesTable from "@/features/identities/components/IdentitiesTable";

import "./snapshot-setup";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/features/identities/hooks", () => ({
	useIdentities: () => ({
		data: { identities: [], hasMore: false, nextPageToken: undefined },
		isLoading: false,
		isError: false,
		error: null,
		refetch: vi.fn(),
	}),
	useIdentitiesSearch: () => ({
		data: { identities: [] },
		isLoading: false,
	}),
}));

vi.mock("@/features/schemas/hooks", () => ({
	useSchemas: () => ({ data: [] }),
}));

describe("IdentitiesTable", () => {
	it("matches snapshot", () => {
		const { container } = render(<IdentitiesTable />);
		expect(container).toMatchSnapshot();
	});
});
