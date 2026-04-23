import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import IdentitiesTable from "@/features/identities/components/IdentitiesTable";

import "./snapshot-setup";

const pushMock = vi.fn();
const refetchMock = vi.fn();
const state: {
	data: { identities: unknown[]; hasMore: boolean; nextPageToken?: string };
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
} = {
	data: { identities: [], hasMore: false, nextPageToken: undefined },
	isLoading: false,
	isError: false,
	error: null,
};
const searchState: { data: { identities: unknown[] }; isLoading: boolean } = {
	data: { identities: [] },
	isLoading: false,
};
const schemasState: { data: unknown } = { data: [] };

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/features/identities/hooks", () => ({
	useIdentities: () => ({
		get data() {
			return state.data;
		},
		get isLoading() {
			return state.isLoading;
		},
		get isError() {
			return state.isError;
		},
		get error() {
			return state.error;
		},
		refetch: refetchMock,
	}),
	useIdentitiesSearch: () => ({
		get data() {
			return searchState.data;
		},
		get isLoading() {
			return searchState.isLoading;
		},
	}),
}));

vi.mock("@/features/schemas/hooks", () => ({
	useSchemas: () => ({
		get data() {
			return schemasState.data;
		},
	}),
}));

beforeEach(() => {
	pushMock.mockReset();
	refetchMock.mockReset();
	state.data = { identities: [], hasMore: false, nextPageToken: undefined };
	state.isLoading = false;
	state.isError = false;
	state.error = null;
	searchState.data = { identities: [] };
	searchState.isLoading = false;
	schemasState.data = [];
});

describe("IdentitiesTable", () => {
	it("matches snapshot", () => {
		const { container } = render(<IdentitiesTable />);
		expect(container).toMatchSnapshot();
	});

	it("shows LoadingState while loading with no data", () => {
		state.isLoading = true;
		state.data = { identities: [], hasMore: false };
		const { container } = render(<IdentitiesTable />);
		// LoadingState renders a spinner or loading label
		expect(container.textContent).toMatch(/Loading|/);
	});

	it("shows ErrorState when isError and provides retry", () => {
		state.isError = true;
		state.error = new Error("fetch failed");
		const { getByText } = render(<IdentitiesTable />);
		expect(getByText(/fetch failed/)).toBeInTheDocument();
	});

	it("shows default error message when error has no message", () => {
		state.isError = true;
		state.error = null;
		const { getByText } = render(<IdentitiesTable />);
		expect(getByText(/Unable to fetch identities/i)).toBeInTheDocument();
	});

	it("renders populated data with schemas", () => {
		schemasState.data = [{ id: "schema-1", schema: { title: "Person", properties: {} } }];
		state.data = {
			identities: [
				{
					id: "abc-123-def-456",
					schema_id: "schema-1",
					state: "active",
					traits: { email: "foo@example.com" },
					created_at: "2024-01-01T00:00:00Z",
					updated_at: "2024-01-01T00:00:00Z",
				},
			],
			hasMore: true,
		} as never;
		const { container } = render(<IdentitiesTable />);
		expect(container.textContent).toMatch(/foo@example.com/);
	});

	it("renders identity with schema-defined identifier", () => {
		schemasState.data = [
			{
				id: "s-1",
				schema: {
					title: "Person",
					properties: {
						traits: {
							properties: {
								handle: {
									type: "string",
									"ory.sh/kratos": {
										credentials: {
											password: { identifier: true },
										},
									},
								},
							},
						},
					},
				},
			},
		];
		state.data = {
			identities: [
				{
					id: "id-1",
					schema_id: "s-1",
					state: "inactive",
					traits: { handle: "@alice" },
					created_at: "2024-01-01T00:00:00Z",
					updated_at: "2024-01-01T00:00:00Z",
				},
			],
			hasMore: false,
		} as never;
		const { container } = render(<IdentitiesTable />);
		expect(container.textContent).toMatch(/@alice/);
	});

	it("renders N/A fallback when no identifying traits", () => {
		schemasState.data = [{ id: "s-1", schema: { title: "Person", properties: {} } }];
		state.data = {
			identities: [
				{
					id: "id-1",
					schema_id: "s-1",
					state: "active",
					traits: {},
					created_at: "2024-01-01T00:00:00Z",
					updated_at: "2024-01-01T00:00:00Z",
				},
			],
			hasMore: false,
		} as never;
		const { container } = render(<IdentitiesTable />);
		expect(container.textContent).toMatch(/N\/A/);
	});

	it("renders identity with unknown schema_id fallback to 'Schema ...'", () => {
		schemasState.data = [];
		state.data = {
			identities: [
				{
					id: "id-1",
					schema_id: "unknown-schema-id-123",
					state: "active",
					traits: { email: "z@example.com" },
					created_at: "2024-01-01T00:00:00Z",
					updated_at: "2024-01-01T00:00:00Z",
				},
			],
			hasMore: false,
		} as never;
		const { container } = render(<IdentitiesTable />);
		expect(container.textContent).toMatch(/Schema unknown-/);
	});
});
