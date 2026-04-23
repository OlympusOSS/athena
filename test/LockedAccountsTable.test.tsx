import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LockedAccountsTable } from "@/features/security/components/LockedAccountsTable";

import "./snapshot-setup";

const mutateAsync = vi.fn();
const state: { isPending: boolean } = { isPending: false };

vi.mock("@/features/security/hooks/useLockedAccounts", () => ({
	useUnlockAccount: () => ({
		mutateAsync,
		get isPending() {
			return state.isPending;
		},
	}),
}));

beforeEach(() => {
	mutateAsync.mockReset();
	state.isPending = false;
});

const now = Date.now();
const accounts = [
	{
		id: "1",
		identifier: "user@example.com",
		lock_reason: "too many attempts",
		trigger_ip: "1.2.3.4",
		auto_threshold_at: 5,
		locked_at: new Date(now - 60000),
		locked_until: new Date(now + 30 * 60000), // 30m remaining
	},
	{
		id: "2",
		identifier: "bob@example.com",
		lock_reason: null,
		trigger_ip: null,
		auto_threshold_at: null,
		locked_at: null,
		locked_until: null,
	},
	{
		id: "3",
		identifier: "expired@example.com",
		lock_reason: "reason",
		trigger_ip: "5.6.7.8",
		auto_threshold_at: 0,
		locked_at: new Date(now - 120000),
		locked_until: new Date(now - 60000), // expired
	},
	{
		id: "4",
		identifier: "hours@example.com",
		lock_reason: "x",
		trigger_ip: "0.0.0.0",
		auto_threshold_at: 10,
		locked_at: new Date(now - 60000),
		locked_until: new Date(now + 3 * 60 * 60 * 1000), // 3 hours
	},
];

describe("LockedAccountsTable", () => {
	it("matches snapshot (empty)", () => {
		const { container } = render(<LockedAccountsTable accounts={[]} isLoading={false} />);
		expect(container).toMatchSnapshot();
	});

	it("renders accounts and triggers unlock on button click", async () => {
		mutateAsync.mockResolvedValue(undefined);
		const onUnlockSuccess = vi.fn();
		const { container, getAllByText } = render(<LockedAccountsTable accounts={accounts} isLoading={false} onUnlockSuccess={onUnlockSuccess} />);
		expect(container.textContent).toMatch(/user@example.com/);
		expect(container.textContent).toMatch(/Expired/);
		// Hours remaining
		expect(container.textContent).toMatch(/h remaining/);
		const unlockButtons = getAllByText("Unlock");
		await act(async () => {
			fireEvent.click(unlockButtons[0]);
		});
		await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
		expect(onUnlockSuccess).toHaveBeenCalled();
	});

	it("handles unlock error and calls onUnlockError", async () => {
		mutateAsync.mockRejectedValue(new Error("unlock fail"));
		const onUnlockError = vi.fn();
		const { getAllByText } = render(<LockedAccountsTable accounts={accounts} isLoading={false} onUnlockError={onUnlockError} />);
		const unlockButtons = getAllByText("Unlock");
		await act(async () => {
			fireEvent.click(unlockButtons[0]);
		});
		await waitFor(() => expect(onUnlockError).toHaveBeenCalled());
	});

	it("handles unlock non-Error rejection", async () => {
		mutateAsync.mockRejectedValue("string-err");
		const onUnlockError = vi.fn();
		const { getAllByText } = render(<LockedAccountsTable accounts={accounts} isLoading={false} onUnlockError={onUnlockError} />);
		const unlockButtons = getAllByText("Unlock");
		await act(async () => {
			fireEvent.click(unlockButtons[0]);
		});
		await waitFor(() => expect(onUnlockError).toHaveBeenCalled());
	});
});
