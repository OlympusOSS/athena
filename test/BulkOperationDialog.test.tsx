import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BulkOperationDialog } from "@/features/identities/components/BulkOperationDialog";

import "./snapshot-setup";

vi.mock("@/services/kratos/endpoints/identities", () => ({
	deleteIdentity: vi.fn(),
	patchIdentity: vi.fn(),
}));

vi.mock("@/services/kratos/endpoints/sessions", () => ({
	deleteIdentitySessions: vi.fn(),
}));

vi.mock("@/lib/demo", () => ({ isDemoIdentity: () => false }));

describe("BulkOperationDialog", () => {
	it("matches snapshot (delete, confirm phase)", () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const identities = [{ id: "abc-123-def-456", schema_id: "default", state: "active", traits: { email: "a@example.com" } }] as never[];
		const { baseElement } = render(
			<QueryClientProvider client={client}>
				<BulkOperationDialog
					open={true}
					onClose={() => {}}
					operationType="delete"
					identityIds={["abc-123-def-456"]}
					identities={identities}
					onSuccess={() => {}}
				/>
			</QueryClientProvider>,
		);
		expect(baseElement).toMatchSnapshot();
	});
});
