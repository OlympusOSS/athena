import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IdentityRecoveryDialog } from "@/features/identities/components/IdentityRecoveryDialog";

import "./snapshot-setup";

const createRecoveryLinkMock = vi.fn();
const isDemoMock = vi.fn();

vi.mock("@/services/kratos", () => ({
	createRecoveryLink: (...args: unknown[]) => createRecoveryLinkMock(...args),
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
	createRecoveryLinkMock.mockReset();
	isDemoMock.mockReset();
	isDemoMock.mockReturnValue(false);
});

describe("IdentityRecoveryDialog", () => {
	it("matches snapshot (open)", () => {
		createRecoveryLinkMock.mockResolvedValue({ data: { recovery_link: "" } });
		const { baseElement } = render(<IdentityRecoveryDialog open={true} onClose={() => {}} identity={identity} />);
		expect(baseElement).toMatchSnapshot();
	});

	it("returns null when identity is null", () => {
		const { container } = render(<IdentityRecoveryDialog open={true} onClose={() => {}} identity={null} />);
		expect(container.innerHTML).toBe("");
	});

	it("generates recovery link on button click and displays it", async () => {
		createRecoveryLinkMock.mockResolvedValue({ data: { recovery_link: "https://example.com/recover/abc" } });
		const { getAllByText, findByDisplayValue } = render(<IdentityRecoveryDialog open={true} onClose={() => {}} identity={identity} />);
		const buttons = getAllByText("Generate Recovery Link");
		// Last one is the footer button
		await act(async () => {
			fireEvent.click(buttons[buttons.length - 1]);
		});
		await findByDisplayValue("https://example.com/recover/abc");
	});

	it("shows error alert when generation fails", async () => {
		createRecoveryLinkMock.mockRejectedValue({
			response: { data: { error: { message: "Nope" } } },
		});
		const { getAllByText, findByText } = render(<IdentityRecoveryDialog open={true} onClose={() => {}} identity={identity} />);
		const buttons = getAllByText("Generate Recovery Link");
		await act(async () => {
			fireEvent.click(buttons[buttons.length - 1]);
		});
		await findByText(/Nope/);
	});

	it("falls back to default error message when no structured error", async () => {
		createRecoveryLinkMock.mockRejectedValue(new Error("net"));
		const { getAllByText, findByText } = render(<IdentityRecoveryDialog open={true} onClose={() => {}} identity={identity} />);
		const buttons = getAllByText("Generate Recovery Link");
		await act(async () => {
			fireEvent.click(buttons[buttons.length - 1]);
		});
		await findByText(/Failed to generate recovery link/);
	});

	it("disables button when demo", () => {
		isDemoMock.mockReturnValue(true);
		const { getAllByText } = render(<IdentityRecoveryDialog open={true} onClose={() => {}} identity={identity} />);
		const buttons = getAllByText("Generate Recovery Link");
		expect((buttons[buttons.length - 1] as HTMLButtonElement).disabled).toBe(true);
	});

	it("Close button calls onClose", () => {
		const onClose = vi.fn();
		const { getAllByText } = render(<IdentityRecoveryDialog open={true} onClose={onClose} identity={identity} />);
		const closeButtons = getAllByText("Close").filter((el) => (el as HTMLElement).tagName === "BUTTON");
		fireEvent.click(closeButtons[closeButtons.length - 1]);
		expect(onClose).toHaveBeenCalled();
	});

	it("copies to clipboard when copy button clicked", async () => {
		createRecoveryLinkMock.mockResolvedValue({ data: { recovery_link: "https://example.com/r" } });
		const writeTextMock = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: writeTextMock },
			configurable: true,
		});
		const { getAllByText, findByDisplayValue, getByTitle } = render(<IdentityRecoveryDialog open={true} onClose={() => {}} identity={identity} />);
		const genBtns = getAllByText("Generate Recovery Link");
		await act(async () => {
			fireEvent.click(genBtns[genBtns.length - 1]);
		});
		await findByDisplayValue("https://example.com/r");
		await act(async () => {
			fireEvent.click(getByTitle("Copy to clipboard"));
		});
		await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith("https://example.com/r"));
	});

	it("falls back to N/A when email trait missing", () => {
		const id = { ...identity, traits: {} };
		const { getByText } = render(<IdentityRecoveryDialog open={true} onClose={() => {}} identity={id as never} />);
		expect(getByText(/N\/A/)).toBeInTheDocument();
	});
});
