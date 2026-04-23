import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SessionDetailDialog } from "@/features/sessions/components/SessionDetailDialog";

import "./snapshot-setup";

vi.mock("@/services/kratos/endpoints/sessions", () => ({
	getSession: vi.fn(),
	disableSession: vi.fn(),
	extendSession: vi.fn(),
}));

describe("SessionDetailDialog", () => {
	it("matches snapshot (loading)", () => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const { baseElement } = render(
			<QueryClientProvider client={client}>
				<SessionDetailDialog open={true} onClose={() => {}} sessionId="abc-123" />
			</QueryClientProvider>,
		);
		expect(baseElement).toMatchSnapshot();
	});
});
