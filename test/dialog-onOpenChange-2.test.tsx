/**
 * Additional onOpenChange tests for BulkOperationDialog, SessionDetailDialog,
 * MessageDetailDialog, and social-connections DeleteConnectionDialog.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "./snapshot-setup";

vi.mock("@olympusoss/canvas", async () => {
	const actual = await vi.importActual<typeof import("@olympusoss/canvas")>("@olympusoss/canvas");
	return {
		...actual,
		Dialog: ({ children, onOpenChange }: { children: React.ReactNode; onOpenChange?: (open: boolean) => void }) => (
			<div>
				<button type="button" data-testid="trigger-close" onClick={() => onOpenChange?.(false)}>
					close
				</button>
				{children}
			</div>
		),
		DialogContent: ({
			children,
			onInteractOutside,
		}: {
			children: React.ReactNode;
			onInteractOutside?: (e: { preventDefault: () => void }) => void;
		}) => (
			<div>
				<button type="button" data-testid="trigger-outside" onClick={() => onInteractOutside?.({ preventDefault: () => {} })}>
					outside
				</button>
				{children}
			</div>
		),
		DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
		DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
		DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	};
});

vi.mock("@/services/kratos/endpoints/identities", () => ({
	deleteIdentity: vi.fn(),
	patchIdentity: vi.fn(),
}));

vi.mock("@/services/kratos/endpoints/sessions", () => ({
	deleteIdentitySessions: vi.fn(),
	getSession: vi.fn().mockRejectedValue(new Error("test")),
	disableSession: vi.fn(),
	extendSession: vi.fn(),
}));

vi.mock("@/lib/demo", () => ({ isDemoIdentity: () => false }));

vi.mock("@/features/messages/hooks", () => ({
	useMessage: () => ({
		data: {
			data: {
				id: "m",
				type: "email",
				status: "sent",
				send_count: 0,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
				recipient: "a@b.c",
				subject: "s",
				body: "",
				dispatches: [],
			},
		},
		isLoading: false,
		error: null,
	}),
}));

vi.mock("@/hooks/useSocialConnections", () => ({
	useDeleteSocialConnection: () => ({
		mutate: vi.fn(),
		isPending: false,
		isError: false,
		error: null,
	}),
}));

import { DeleteConnectionDialog } from "@/app/(app)/social-connections/components/DeleteConnectionDialog";
import { BulkOperationDialog } from "@/features/identities/components/BulkOperationDialog";
import { MessageDetailDialog } from "@/features/messages/components/MessageDetailDialog";
import { SessionDetailDialog } from "@/features/sessions/components/SessionDetailDialog";

function wrap(ui: React.ReactNode) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
	globalThis.fetch = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))) as unknown as typeof fetch;
});

describe("Dialog onOpenChange branches — extended", () => {
	it("BulkOperationDialog onOpenChange(false) calls handleClose → onClose", () => {
		const onClose = vi.fn();
		const { getByTestId } = render(
			wrap(
				<BulkOperationDialog
					open={true}
					onClose={onClose}
					operationType="delete"
					identityIds={["id-1"]}
					identities={[{ id: "id-1", traits: { email: "a@b.c" } } as never]}
					onSuccess={() => {}}
				/>,
			),
		);
		fireEvent.click(getByTestId("trigger-close"));
		expect(onClose).toHaveBeenCalled();
	});

	it("BulkOperationDialog onInteractOutside when processing prevents default", () => {
		const { getByTestId } = render(
			wrap(
				<BulkOperationDialog
					open={true}
					onClose={() => {}}
					operationType="delete"
					identityIds={["id-1"]}
					identities={[{ id: "id-1", traits: { email: "a" } } as never]}
					onSuccess={() => {}}
				/>,
			),
		);
		fireEvent.click(getByTestId("trigger-outside"));
	});

	it("SessionDetailDialog onOpenChange(false) calls onClose (loading state)", () => {
		const onClose = vi.fn();
		const { getByTestId } = render(wrap(<SessionDetailDialog open={true} onClose={onClose} sessionId="s-1" />));
		fireEvent.click(getByTestId("trigger-close"));
		expect(onClose).toHaveBeenCalled();
	});

	it("MessageDetailDialog onOpenChange(false) calls onClose", () => {
		const onClose = vi.fn();
		const { getByTestId } = render(wrap(<MessageDetailDialog open={true} onClose={onClose} messageId="m" />));
		fireEvent.click(getByTestId("trigger-close"));
		expect(onClose).toHaveBeenCalled();
	});

	it("DeleteConnectionDialog onOpenChange(false) calls onCancel", () => {
		const onCancel = vi.fn();
		const { getByTestId } = render(<DeleteConnectionDialog open={true} provider="google" onSuccess={() => {}} onCancel={onCancel} />);
		fireEvent.click(getByTestId("trigger-close"));
		expect(onCancel).toHaveBeenCalled();
	});
});
