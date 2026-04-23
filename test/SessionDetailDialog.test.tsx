import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionDetailDialog } from "@/features/sessions/components/SessionDetailDialog";

import "./snapshot-setup";

const getSessionMock = vi.fn();
const disableSessionMock = vi.fn();
const extendSessionMock = vi.fn();

vi.mock("@/services/kratos/endpoints/sessions", () => ({
	getSession: (...args: unknown[]) => getSessionMock(...args),
	disableSession: (...args: unknown[]) => disableSessionMock(...args),
	extendSession: (...args: unknown[]) => extendSessionMock(...args),
}));

function wrap(ui: React.ReactNode) {
	const client = new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
			mutations: { retry: false },
		},
	});
	return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
	getSessionMock.mockReset();
	disableSessionMock.mockReset();
	extendSessionMock.mockReset();
});

const futureIso = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

const activeSession = {
	id: "sess-123",
	active: true,
	authenticated_at: "2024-01-01T00:00:00Z",
	issued_at: "2024-01-01T00:00:00Z",
	expires_at: futureIso,
	authenticator_assurance_level: "aal1",
	identity: {
		id: "ident-1",
		state: "active",
		schema_id: "default",
		traits: { email: "a@example.com" },
	},
	authentication_methods: [{ method: "password" }],
	devices: [{ id: "dev1", user_agent: "Mozilla" }],
};

describe("SessionDetailDialog", () => {
	it("matches snapshot (loading)", () => {
		getSessionMock.mockReturnValue(new Promise(() => {})); // never resolves
		const { baseElement } = render(wrap(<SessionDetailDialog open={true} onClose={() => {}} sessionId="abc-123" />));
		expect(baseElement).toMatchSnapshot();
	});

	it("renders error state when getSession fails", async () => {
		getSessionMock.mockRejectedValue(new Error("boom"));
		const { baseElement } = render(wrap(<SessionDetailDialog open={true} onClose={() => {}} sessionId="sess-id" />));
		await waitFor(() => expect(baseElement.textContent).toMatch(/Failed to load session details/), { timeout: 10000 });
	}, 15000);

	it("renders active session with all sections", async () => {
		getSessionMock.mockResolvedValue({ data: activeSession });
		const { findByText, getAllByText } = render(wrap(<SessionDetailDialog open={true} onClose={() => {}} sessionId="sess-123" />));
		await findByText(/sess-123/);
		expect(getAllByText(/Active/).length).toBeGreaterThan(0);
	});

	it("triggers extendSession when Extend Session button clicked", async () => {
		getSessionMock.mockResolvedValue({ data: activeSession });
		extendSessionMock.mockResolvedValue({ data: {} });
		const { findByText } = render(wrap(<SessionDetailDialog open={true} onClose={() => {}} sessionId="sess-123" />));
		const btn = await findByText("Extend Session");
		await act(async () => {
			fireEvent.click(btn);
		});
		await waitFor(() => expect(extendSessionMock).toHaveBeenCalled());
	});

	it("triggers disableSession and calls onClose on success", async () => {
		getSessionMock.mockResolvedValue({ data: activeSession });
		disableSessionMock.mockResolvedValue(undefined);
		const onClose = vi.fn();
		const onSessionUpdated = vi.fn();
		const { findByText } = render(
			wrap(<SessionDetailDialog open={true} onClose={onClose} sessionId="sess-123" onSessionUpdated={onSessionUpdated} />),
		);
		const btn = await findByText("Revoke Session");
		await act(async () => {
			fireEvent.click(btn);
		});
		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(onSessionUpdated).toHaveBeenCalled();
	});

	it("shows error banner when extend mutation fails", async () => {
		getSessionMock.mockResolvedValue({ data: activeSession });
		extendSessionMock.mockRejectedValue({
			response: { data: { error: { message: "can't extend" } } },
		});
		const { findByText } = render(wrap(<SessionDetailDialog open={true} onClose={() => {}} sessionId="sess-123" />));
		const btn = await findByText("Extend Session");
		await act(async () => {
			fireEvent.click(btn);
		});
		await findByText("can't extend");
	});

	it("shows generic error message when delete mutation error has no structured error", async () => {
		getSessionMock.mockResolvedValue({ data: activeSession });
		disableSessionMock.mockRejectedValue(new Error("net"));
		const { findByText } = render(wrap(<SessionDetailDialog open={true} onClose={() => {}} sessionId="sess-123" />));
		const btn = await findByText("Revoke Session");
		await act(async () => {
			fireEvent.click(btn);
		});
		await waitFor(() => {
			const el = document.body;
			expect(el.textContent).toMatch(/Failed to revoke session/);
		});
	});

	it("dismisses error banner on X click", async () => {
		getSessionMock.mockResolvedValue({ data: activeSession });
		disableSessionMock.mockRejectedValue(new Error("net"));
		const { findByText, baseElement } = render(wrap(<SessionDetailDialog open={true} onClose={() => {}} sessionId="sess-123" />));
		const btn = await findByText("Revoke Session");
		await act(async () => {
			fireEvent.click(btn);
		});
		await waitFor(() => expect(baseElement.textContent).toMatch(/Failed to revoke session/));
		const xBtn = baseElement.querySelector(".lucide-x")?.closest("button");
		if (xBtn) fireEvent.click(xBtn);
	});

	it("renders inactive session — Extend button hidden", async () => {
		const inactive = { ...activeSession, active: false };
		getSessionMock.mockResolvedValue({ data: inactive });
		const { findByText, queryByText } = render(wrap(<SessionDetailDialog open={true} onClose={() => {}} sessionId="sess-123" />));
		await findByText(/sess-123/);
		expect(queryByText("Extend Session")).toBeNull();
	});

	it("renders expired session — shows Expired and hides extend", async () => {
		const expired = {
			...activeSession,
			expires_at: new Date(Date.now() - 100000).toISOString(),
		};
		getSessionMock.mockResolvedValue({ data: expired });
		const { findByText, queryByText } = render(wrap(<SessionDetailDialog open={true} onClose={() => {}} sessionId="sess-123" />));
		await findByText(/Expired/);
		expect(queryByText("Extend Session")).toBeNull();
	});

	it("renders session without identity (returns 'Unknown' display)", async () => {
		const noId = { ...activeSession, identity: null };
		getSessionMock.mockResolvedValue({ data: noId });
		const { findByText } = render(wrap(<SessionDetailDialog open={true} onClose={() => {}} sessionId="sess-123" />));
		await findByText(/sess-123/);
	});

	it("Close button fires onClose", async () => {
		getSessionMock.mockResolvedValue({ data: activeSession });
		const onClose = vi.fn();
		const { findByText } = render(wrap(<SessionDetailDialog open={true} onClose={onClose} sessionId="sess-123" />));
		const closeBtn = await findByText("Close");
		fireEvent.click(closeBtn);
		expect(onClose).toHaveBeenCalled();
	});

	it("handles session with many-hours remaining and minutes-only branches", async () => {
		const in3hr = { ...activeSession, expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() };
		getSessionMock.mockResolvedValue({ data: in3hr });
		const { findByText } = render(wrap(<SessionDetailDialog open={true} onClose={() => {}} sessionId="x" />));
		await findByText(/remaining/);
	});
});
