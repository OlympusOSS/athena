import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IdentityResetPasswordDialog } from "@/features/identities/components/IdentityResetPasswordDialog";

import "./snapshot-setup";

const mutate = vi.fn();
const reset = vi.fn();
const state: { isPending: boolean; isError: boolean; error: Error | null } = {
	isPending: false,
	isError: false,
	error: null,
};
const isDemoMock = vi.fn();

vi.mock("@/features/identities/hooks/useIdentities", () => ({
	useResetIdentityPassword: () => ({
		mutate,
		reset,
		get isPending() {
			return state.isPending;
		},
		get isError() {
			return state.isError;
		},
		get error() {
			return state.error;
		},
	}),
}));

vi.mock("@/lib/demo", () => ({ isDemoIdentity: (...args: unknown[]) => isDemoMock(...args) }));

const identity = {
	id: "abc-123-def-456",
	schema_id: "default",
	state: "active",
	traits: { email: "user@example.com" },
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-01-01T00:00:00Z",
} as never;

beforeEach(() => {
	mutate.mockReset();
	reset.mockReset();
	state.isPending = false;
	state.isError = false;
	state.error = null;
	isDemoMock.mockReset();
	isDemoMock.mockReturnValue(false);
});

describe("IdentityResetPasswordDialog", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(<IdentityResetPasswordDialog open={true} onClose={() => {}} identity={identity} />);
		expect(baseElement).toMatchSnapshot();
	});

	it("returns null when identity is null", () => {
		const { container } = render(<IdentityResetPasswordDialog open={true} onClose={() => {}} identity={null} />);
		expect(container.innerHTML).toBe("");
	});

	it("shows short password warning", () => {
		const { getByLabelText, getByText } = render(<IdentityResetPasswordDialog open={true} onClose={() => {}} identity={identity} />);
		fireEvent.change(getByLabelText("New Password"), { target: { value: "short" } });
		expect(getByText(/at least 12 characters/i)).toBeInTheDocument();
	});

	it("shows mismatch warning", () => {
		const { getByLabelText, getByText } = render(<IdentityResetPasswordDialog open={true} onClose={() => {}} identity={identity} />);
		fireEvent.change(getByLabelText("New Password"), { target: { value: "abcdefghij12" } });
		fireEvent.change(getByLabelText("Confirm Password"), { target: { value: "different" } });
		expect(getByText("Passwords do not match")).toBeInTheDocument();
	});

	it("submits reset password when valid", () => {
		const { getAllByText, getByLabelText } = render(<IdentityResetPasswordDialog open={true} onClose={() => {}} identity={identity} />);
		fireEvent.change(getByLabelText("New Password"), { target: { value: "securepassword12" } });
		fireEvent.change(getByLabelText("Confirm Password"), { target: { value: "securepassword12" } });
		const btns = getAllByText("Reset Password").filter((el) => (el as HTMLElement).tagName === "BUTTON");
		fireEvent.click(btns[btns.length - 1]);
		expect(mutate).toHaveBeenCalled();
	});

	it("shows success state after mutate onSuccess", async () => {
		mutate.mockImplementation((_vars, opts) => {
			opts.onSuccess();
		});
		const onClose = vi.fn();
		const onSuccess = vi.fn();
		const { getAllByText, getByLabelText, findByText } = render(
			<IdentityResetPasswordDialog open={true} onClose={onClose} identity={identity} onSuccess={onSuccess} />,
		);
		fireEvent.change(getByLabelText("New Password"), { target: { value: "securepassword12" } });
		fireEvent.change(getByLabelText("Confirm Password"), { target: { value: "securepassword12" } });
		const btns = getAllByText("Reset Password").filter((el) => (el as HTMLElement).tagName === "BUTTON");
		fireEvent.click(btns[btns.length - 1]);
		await findByText(/Password has been reset successfully/);
	});

	it("shows Resetting... label while pending", () => {
		state.isPending = true;
		const { getByText } = render(<IdentityResetPasswordDialog open={true} onClose={() => {}} identity={identity} />);
		expect(getByText(/Resetting/)).toBeInTheDocument();
	});

	it("disables reset button for demo account", () => {
		isDemoMock.mockReturnValue(true);
		const { getByText } = render(<IdentityResetPasswordDialog open={true} onClose={() => {}} identity={identity} />);
		expect(getByText(/disabled for demo accounts/i)).toBeInTheDocument();
	});

	it("shows error alert on failure", () => {
		state.isError = true;
		state.error = new Error("weak password");
		const { getByText } = render(<IdentityResetPasswordDialog open={true} onClose={() => {}} identity={identity} />);
		expect(getByText(/Failed to reset password: weak password/)).toBeInTheDocument();
	});

	it("Cancel button fires handleClose (calls onClose)", () => {
		const onClose = vi.fn();
		const { getByText } = render(<IdentityResetPasswordDialog open={true} onClose={onClose} identity={identity} />);
		fireEvent.click(getByText("Cancel"));
		expect(onClose).toHaveBeenCalled();
		expect(reset).toHaveBeenCalled();
	});

	it("renders character counter when password has content", () => {
		const { getByLabelText, getByText } = render(<IdentityResetPasswordDialog open={true} onClose={() => {}} identity={identity} />);
		fireEvent.change(getByLabelText("New Password"), { target: { value: "abcdefghijkl" } });
		expect(getByText("12 characters")).toBeInTheDocument();
	});

	it("falls back to N/A when email trait missing", () => {
		const id = { ...identity, traits: {} };
		const { getByText } = render(<IdentityResetPasswordDialog open={true} onClose={() => {}} identity={id as never} />);
		expect(getByText(/N\/A/)).toBeInTheDocument();
	});

	it("shows 'Unknown error' when error has no message", () => {
		state.isError = true;
		state.error = {} as Error;
		const { getByText } = render(<IdentityResetPasswordDialog open={true} onClose={() => {}} identity={identity} />);
		expect(getByText(/Failed to reset password: Unknown error/)).toBeInTheDocument();
	});

	it("renders amber strength bar for strong password (i < 2) and green for longer", () => {
		const { getByLabelText, baseElement } = render(<IdentityResetPasswordDialog open={true} onClose={() => {}} identity={identity} />);
		// Enter a very long password so strength bars at i >= 2 (threshold 20 and 24) are filled green
		fireEvent.change(getByLabelText("New Password"), { target: { value: "a".repeat(24) } });
		// Radix Dialog portal content lives under document.body
		const bars = baseElement.querySelectorAll('div[class*="h-1"][class*="flex-1"][class*="rounded-full"]');
		expect(bars.length).toBe(4);
		// The first two bars (i=0,1) should be amber; bars i=2,3 should be green
		expect(bars[0].className).toMatch(/bg-amber-500/);
		expect(bars[2].className).toMatch(/bg-green-500/);
	});

	it("triggers onSuccess and setTimeout after successful mutate", async () => {
		vi.useFakeTimers();
		mutate.mockImplementation((_vars, opts) => {
			opts.onSuccess();
		});
		const onClose = vi.fn();
		const onSuccess = vi.fn();
		const { getAllByText, getByLabelText } = render(
			<IdentityResetPasswordDialog open={true} onClose={onClose} identity={identity} onSuccess={onSuccess} />,
		);
		fireEvent.change(getByLabelText("New Password"), { target: { value: "securepassword12" } });
		fireEvent.change(getByLabelText("Confirm Password"), { target: { value: "securepassword12" } });
		const btns = getAllByText("Reset Password").filter((el) => (el as HTMLElement).tagName === "BUTTON");
		fireEvent.click(btns[btns.length - 1]);
		// Advance timers
		vi.advanceTimersByTime(1600);
		expect(onSuccess).toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
		vi.useRealTimers();
	});
});
