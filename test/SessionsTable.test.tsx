import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SessionsTable } from "@/features/sessions/components/SessionsTable";

import "./snapshot-setup";

describe("SessionsTable", () => {
	it("matches snapshot (empty)", () => {
		const { container } = render(<SessionsTable sessions={[]} isLoading={false} isFetchingNextPage={false} searchQuery="" />);
		expect(container).toMatchSnapshot();
	});

	it("renders 'try different search' empty message when searchQuery provided", () => {
		const { container } = render(<SessionsTable sessions={[]} isLoading={false} isFetchingNextPage={false} searchQuery="foo" />);
		expect(container.textContent).toMatch(/different search term/);
	});

	it("renders populated sessions with various states", () => {
		const now = new Date();
		const future = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days
		const nearFuture = new Date(now.getTime() + 5 * 60 * 1000).toISOString(); // 5 minutes
		const hoursFuture = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(); // 3 hours
		const expired = new Date(now.getTime() - 100000).toISOString();
		const sessions = [
			{
				id: "sess-abc-1234",
				active: true,
				authenticated_at: "2024-01-01T00:00:00Z",
				expires_at: future,
				identity: { id: "ident-1", traits: { email: "user@example.com" } },
			},
			{
				id: "sess-def-5678",
				active: false,
				authenticated_at: null,
				expires_at: hoursFuture,
				identity: { id: "ident-2", traits: { username: "bob" } },
			},
			{
				id: "sess-xyz-9999",
				active: true,
				authenticated_at: "2024-01-01T00:00:00Z",
				expires_at: nearFuture,
				identity: { id: "ident-3", traits: {} },
			},
			{
				id: "sess-expired",
				active: false,
				authenticated_at: null,
				expires_at: expired,
				identity: null,
			},
			{
				id: "sess-no-expiry",
				active: true,
				authenticated_at: null,
				expires_at: null,
				identity: { id: "ident-4" },
			},
		];
		const { container } = render(<SessionsTable sessions={sessions as never} isLoading={false} isFetchingNextPage={false} searchQuery="" />);
		expect(container.textContent).toMatch(/Active/);
		expect(container.textContent).toMatch(/Inactive/);
		expect(container.textContent).toMatch(/Unknown/);
		expect(container.textContent).toMatch(/Expired/);
	});

	it("invokes onSessionClick on row click", () => {
		const onSessionClick = vi.fn();
		const sessions = [
			{
				id: "s1",
				active: true,
				authenticated_at: "2024-01-01T00:00:00Z",
				expires_at: "2030-01-01T00:00:00Z",
				identity: { id: "id-1", traits: { email: "a@b.c" } },
			},
		];
		const { container } = render(
			<SessionsTable sessions={sessions as never} isLoading={false} isFetchingNextPage={false} searchQuery="" onSessionClick={onSessionClick} />,
		);
		const row = container.querySelector("tbody tr");
		if (row) fireEvent.click(row);
		expect(onSessionClick).toHaveBeenCalledWith("s1");
	});
});
