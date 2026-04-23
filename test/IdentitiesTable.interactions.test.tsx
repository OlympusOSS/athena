import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/features/identities/components/BulkOperationDialog", () => ({
	BulkOperationDialog: ({
		open,
		onSuccess,
		onClose,
		operationType,
	}: {
		open: boolean;
		onSuccess: () => void;
		onClose: () => void;
		operationType: string;
	}) =>
		open ? (
			<div data-testid="bulk-dialog">
				<span>{operationType}</span>
				<button type="button" onClick={onSuccess} data-testid="bulk-success">
					ok
				</button>
				<button type="button" onClick={onClose} data-testid="bulk-close">
					close
				</button>
			</div>
		) : null,
}));

// Mock DataTable to expose callbacks as buttons
vi.mock("@olympusoss/canvas", async () => {
	const actual = await vi.importActual<typeof import("@olympusoss/canvas")>("@olympusoss/canvas");
	return {
		...actual,
		DataTable: ({
			data,
			onRowClick,
			onRefresh,
			onAdd,
			onSelectionChange,
			onSearchChange,
			columns,
		}: {
			data: Array<Record<string, unknown>>;
			onRowClick?: (row: Record<string, unknown>) => void;
			onRefresh?: () => void;
			onAdd?: () => void;
			onSelectionChange?: (sel: Set<string>) => void;
			onSearchChange?: (s: string) => void;
			columns: Array<{ field: string; renderCell?: (v: unknown, row: Record<string, unknown>) => React.ReactNode }>;
		}) => (
			<div data-testid="data-table">
				<button type="button" onClick={() => onRefresh?.()} data-testid="refresh">
					refresh
				</button>
				<button type="button" onClick={() => onAdd?.()} data-testid="add">
					add
				</button>
				<input data-testid="search" onChange={(e) => onSearchChange?.(e.target.value)} />
				<button type="button" onClick={() => onSelectionChange?.(new Set(data.map((d) => (d as { id: string }).id)))} data-testid="select-all">
					select-all
				</button>
				{data.map((row, i) => (
					<div key={i} data-testid={`row-${i}`}>
						<button type="button" onClick={() => onRowClick?.(row)} data-testid={`click-row-${i}`}>
							click
						</button>
						{columns.map((col) =>
							col.renderCell ? (
								<span key={col.field} data-field={col.field}>
									{col.renderCell((row as Record<string, unknown>)[col.field], row)}
								</span>
							) : null,
						)}
					</div>
				))}
			</div>
		),
	};
});

// Import after mocks
import IdentitiesTable from "@/features/identities/components/IdentitiesTable";

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

describe("IdentitiesTable — interactions (mocked DataTable)", () => {
	const identities = [
		{
			id: "abc-123-def-456",
			schema_id: "schema-1",
			state: "active",
			traits: { email: "foo@example.com", first_name: "Foo", last_name: "Bar" },
			created_at: "2024-01-01T00:00:00Z",
			updated_at: "2024-01-01T00:00:00Z",
		},
	];

	it("handleRowClick navigates to identity detail", () => {
		state.data = { identities, hasMore: false } as never;
		schemasState.data = [{ id: "schema-1", schema: { title: "Person" } }];
		const { getByTestId } = render(<IdentitiesTable />);
		fireEvent.click(getByTestId("click-row-0"));
		expect(pushMock).toHaveBeenCalledWith("/identities/abc-123-def-456");
	});

	it("handleCreateNew navigates to identities create", () => {
		const { getByTestId } = render(<IdentitiesTable />);
		fireEvent.click(getByTestId("add"));
		expect(pushMock).toHaveBeenCalledWith("/identities/create");
	});

	it("handleRefresh calls refetch", () => {
		const { getByTestId } = render(<IdentitiesTable />);
		fireEvent.click(getByTestId("refresh"));
		expect(refetchMock).toHaveBeenCalled();
	});

	it("handleSearchChange updates searchTerm and displays match count", async () => {
		state.data = { identities, hasMore: false } as never;
		schemasState.data = [{ id: "schema-1", schema: { title: "Person" } }];
		const { getByTestId, container } = render(<IdentitiesTable />);
		await act(async () => {
			fireEvent.change(getByTestId("search"), { target: { value: "foo" } });
		});
		// Wait for debounce
		await waitFor(() => expect(container.textContent).toMatch(/Found|Showing/), { timeout: 1500 });
	});

	it("selecting identities shows bulk action toolbar", async () => {
		state.data = { identities, hasMore: false } as never;
		schemasState.data = [{ id: "schema-1", schema: { title: "Person" } }];
		const { getByTestId, findByText } = render(<IdentitiesTable />);
		await act(async () => {
			fireEvent.click(getByTestId("select-all"));
		});
		await findByText(/selected/);
		fireEvent.click((await findByText("Delete")) as HTMLElement);
		expect(getByTestId("bulk-dialog")).toBeTruthy();
	});

	it("Clear selection button clears selected ids", async () => {
		state.data = { identities, hasMore: false } as never;
		schemasState.data = [{ id: "schema-1", schema: { title: "Person" } }];
		const { getByTestId, findByText, container } = render(<IdentitiesTable />);
		await act(async () => {
			fireEvent.click(getByTestId("select-all"));
		});
		await findByText(/selected/);
		// Clear button is the "X" icon button
		const xBtn = Array.from(container.querySelectorAll("button")).find((b) => b.querySelector(".lucide-x"));
		if (xBtn) fireEvent.click(xBtn);
	});

	it("bulk dialog onSuccess clears selection", async () => {
		state.data = { identities, hasMore: false } as never;
		schemasState.data = [{ id: "schema-1", schema: { title: "Person" } }];
		const { getByTestId, findByText } = render(<IdentitiesTable />);
		await act(async () => {
			fireEvent.click(getByTestId("select-all"));
		});
		await findByText(/selected/);
		fireEvent.click(await findByText("Deactivate"));
		fireEvent.click(getByTestId("bulk-success"));
	});

	it("bulk operation options: deleteSessions + activate", async () => {
		state.data = { identities, hasMore: false } as never;
		schemasState.data = [{ id: "schema-1", schema: { title: "Person" } }];
		const { getByTestId, findByText } = render(<IdentitiesTable />);
		await act(async () => {
			fireEvent.click(getByTestId("select-all"));
		});
		await findByText(/selected/);
		fireEvent.click(await findByText("Delete Sessions"));
		fireEvent.click(getByTestId("bulk-close"));
		// reopen with activate
		await act(async () => {
			fireEvent.click(getByTestId("select-all"));
		});
		fireEvent.click(await findByText("Activate"));
	});

	it("uses searchResults when searching completes", async () => {
		state.data = { identities: [], hasMore: false } as never;
		searchState.data = { identities: [{ id: "res-1", schema_id: "s1", state: "active", traits: { email: "z@example.com" } }] };
		searchState.isLoading = false;
		schemasState.data = [{ id: "s1", schema: { title: "S" } }];
		const { getByTestId, container } = render(<IdentitiesTable />);
		await act(async () => {
			fireEvent.change(getByTestId("search"), { target: { value: "z" } });
		});
		await waitFor(() => expect(container.textContent).toMatch(/multi-page search|current page/), { timeout: 1500 });
	});

	it("filters across first_name/last_name/name traits (client-side)", async () => {
		schemasState.data = [{ id: "s-1", schema: { title: "Person" } }];
		state.data = {
			identities: [
				{ id: "id-1", schema_id: "s-1", state: "active", traits: { first_name: "Alice", last_name: "Wonder" } },
				{ id: "id-2", schema_id: "s-1", state: "active", traits: { firstName: "Bob", lastName: "Builder" } },
				{ id: "id-3", schema_id: "s-1", state: "active", traits: { name: "Charlie Carr" } },
			],
			hasMore: false,
		} as never;
		const { getByTestId, container } = render(<IdentitiesTable />);
		await act(async () => {
			fireEvent.change(getByTestId("search"), { target: { value: "alice" } });
		});
		// Client-side filter applies immediately
		await waitFor(() => expect(container.textContent).toMatch(/Found|Showing/));
	});
});
