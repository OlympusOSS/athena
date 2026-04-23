import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BulkOperationDialog } from "@/features/identities/components/BulkOperationDialog";

import "./snapshot-setup";

const deleteIdentityMock = vi.fn();
const patchIdentityMock = vi.fn();
const deleteIdentitySessionsMock = vi.fn();
const isDemoIdentityMock = vi.fn();

vi.mock("@/services/kratos/endpoints/identities", () => ({
	deleteIdentity: (...args: unknown[]) => deleteIdentityMock(...args),
	patchIdentity: (...args: unknown[]) => patchIdentityMock(...args),
}));

vi.mock("@/services/kratos/endpoints/sessions", () => ({
	deleteIdentitySessions: (...args: unknown[]) => deleteIdentitySessionsMock(...args),
}));

vi.mock("@/lib/demo", () => ({
	isDemoIdentity: (...args: unknown[]) => isDemoIdentityMock(...args),
}));

function wrap(ui: React.ReactNode) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

const IDS = ["abc-123-def-456"];
const identities = [
	{
		id: "abc-123-def-456",
		schema_id: "default",
		state: "active",
		traits: { email: "a@example.com", name: { first: "A", last: "B" } },
	},
] as never[];

beforeEach(() => {
	deleteIdentityMock.mockReset();
	patchIdentityMock.mockReset();
	deleteIdentitySessionsMock.mockReset();
	isDemoIdentityMock.mockReset();
	isDemoIdentityMock.mockReturnValue(false);
});

describe("BulkOperationDialog", () => {
	it("matches snapshot (delete, confirm phase)", () => {
		const { baseElement } = render(
			wrap(
				<BulkOperationDialog open={true} onClose={() => {}} operationType="delete" identityIds={IDS} identities={identities} onSuccess={() => {}} />,
			),
		);
		expect(baseElement).toMatchSnapshot();
	});

	it("runs delete operation and fires onSuccess", async () => {
		deleteIdentityMock.mockResolvedValue(undefined);
		const onSuccess = vi.fn();
		const onClose = vi.fn();
		const { getByText } = render(
			wrap(
				<BulkOperationDialog open={true} onClose={onClose} operationType="delete" identityIds={IDS} identities={identities} onSuccess={onSuccess} />,
			),
		);
		await act(async () => {
			fireEvent.click(getByText("Delete"));
		});
		await waitFor(() => expect(deleteIdentityMock).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(onSuccess).toHaveBeenCalled());
	});

	it("runs activate operation with patchIdentity", async () => {
		patchIdentityMock.mockResolvedValue(undefined);
		const { getByText } = render(
			wrap(
				<BulkOperationDialog
					open={true}
					onClose={() => {}}
					operationType="activate"
					identityIds={IDS}
					identities={identities}
					onSuccess={() => {}}
				/>,
			),
		);
		await act(async () => {
			fireEvent.click(getByText("Activate"));
		});
		await waitFor(() => expect(patchIdentityMock).toHaveBeenCalled());
	});

	it("runs deactivate operation with patchIdentity", async () => {
		patchIdentityMock.mockResolvedValue(undefined);
		const { getByText } = render(
			wrap(
				<BulkOperationDialog
					open={true}
					onClose={() => {}}
					operationType="deactivate"
					identityIds={IDS}
					identities={identities}
					onSuccess={() => {}}
				/>,
			),
		);
		await act(async () => {
			fireEvent.click(getByText("Deactivate"));
		});
		await waitFor(() => expect(patchIdentityMock).toHaveBeenCalled());
	});

	it("runs deleteSessions operation", async () => {
		deleteIdentitySessionsMock.mockResolvedValue(undefined);
		const { getAllByText } = render(
			wrap(
				<BulkOperationDialog
					open={true}
					onClose={() => {}}
					operationType="deleteSessions"
					identityIds={IDS}
					identities={identities}
					onSuccess={() => {}}
				/>,
			),
		);
		const buttons = getAllByText("Delete Sessions");
		// Last match is the confirm button
		await act(async () => {
			fireEvent.click(buttons[buttons.length - 1]);
		});
		await waitFor(() => expect(deleteIdentitySessionsMock).toHaveBeenCalled());
	});

	it("skips demo identities during delete", async () => {
		isDemoIdentityMock.mockReturnValue(true);
		const { getByText, queryAllByText } = render(
			wrap(
				<BulkOperationDialog open={true} onClose={() => {}} operationType="delete" identityIds={IDS} identities={identities} onSuccess={() => {}} />,
			),
		);
		// Pre-confirmation, "1 demo account is protected" banner should show
		expect(queryAllByText(/demo/).length).toBeGreaterThanOrEqual(1);
		await act(async () => {
			fireEvent.click(getByText("Delete"));
		});
		await waitFor(() => expect(deleteIdentityMock).not.toHaveBeenCalled());
	});

	it("cancel closes the dialog", () => {
		const onClose = vi.fn();
		const { getByText } = render(
			wrap(
				<BulkOperationDialog open={true} onClose={onClose} operationType="delete" identityIds={IDS} identities={identities} onSuccess={() => {}} />,
			),
		);
		fireEvent.click(getByText("Cancel"));
		expect(onClose).toHaveBeenCalled();
	});

	it("handles error during bulk operation and shows errors", async () => {
		deleteIdentityMock.mockRejectedValue(new Error("fail"));
		const onSuccess = vi.fn();
		const { getByText } = render(
			wrap(
				<BulkOperationDialog open={true} onClose={() => {}} operationType="delete" identityIds={IDS} identities={identities} onSuccess={onSuccess} />,
			),
		);
		await act(async () => {
			fireEvent.click(getByText("Delete"));
		});
		await waitFor(() => expect(getByText(/failed/)).toBeTruthy());
		fireEvent.click(getByText("Show errors"));
		fireEvent.click(getByText("Hide errors"));
		// Multiple "Close" may exist (DialogClose sr-only + footer button). Use last.
		const { getAllByRole } = within(document.body);
		const closeButtons = getAllByRole("button").filter((b) => b.textContent === "Close");
		fireEvent.click(closeButtons[0]);
	});

	it("handles large selected lists (renders 'more' row)", () => {
		const many = Array.from({ length: 10 }, (_, i) => ({
			id: `id-${i}-xxxxxxxx`,
			schema_id: "default",
			state: "active",
			traits: { email: `user${i}@example.com` },
		})) as never[];
		const manyIds = many.map((i) => (i as { id: string }).id);
		const { getByText } = render(
			wrap(
				<BulkOperationDialog open={true} onClose={() => {}} operationType="delete" identityIds={manyIds} identities={many} onSuccess={() => {}} />,
			),
		);
		expect(getByText(/more/)).toBeTruthy();
	});

	it("renders traits.username fallback", () => {
		const ids = [{ id: "u1-xxxxxxxx", schema_id: "default", state: "active", traits: { username: "joe" } }] as never[];
		const { getByText } = render(
			wrap(
				<BulkOperationDialog
					open={true}
					onClose={() => {}}
					operationType="delete"
					identityIds={["u1-xxxxxxxx"]}
					identities={ids}
					onSuccess={() => {}}
				/>,
			),
		);
		expect(getByText(/joe/)).toBeTruthy();
	});

	it("renders id prefix fallback when no identifying traits", () => {
		const ids = [{ id: "id-only-xxxxxxxx", schema_id: "default", state: "active", traits: {} }] as never[];
		const { getAllByText } = render(
			wrap(
				<BulkOperationDialog
					open={true}
					onClose={() => {}}
					operationType="delete"
					identityIds={["id-only-xxxxxxxx"]}
					identities={ids}
					onSuccess={() => {}}
				/>,
			),
		);
		// Multiple "id-only-" text chunks appear (display name + code element)
		expect(getAllByText(/id-only-/).length).toBeGreaterThan(0);
	});
});
