import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateM2MClientModal } from "@/features/m2m-clients/components/CreateM2MClientModal";
import { M2M_PERMITTED_SCOPES } from "@/lib/m2m-scopes";

import "./snapshot-setup";

describe("CreateM2MClientModal", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		expect(baseElement).toMatchSnapshot();
	});

	it("validates required client_name field", async () => {
		const onSubmit = vi.fn();
		const { getByText, findByText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={onSubmit} />);
		// With empty name, clicking submit should display required error (but actually button is disabled)
		// Toggle scope first
		const firstScopeCheckbox = document.getElementById(`scope-${M2M_PERMITTED_SCOPES[0]}`);
		if (firstScopeCheckbox) fireEvent.click(firstScopeCheckbox);
		fireEvent.click(getByText("Create Client"));
		await findByText(/Client name is required/);
	});

	it("submits form with valid data", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const { getByText, getByLabelText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={onSubmit} />);
		fireEvent.change(getByLabelText(/Client Name/), { target: { value: "agent-1" } });
		const firstScopeCheckbox = document.getElementById(`scope-${M2M_PERMITTED_SCOPES[0]}`);
		if (firstScopeCheckbox) fireEvent.click(firstScopeCheckbox);
		await act(async () => {
			fireEvent.click(getByText("Create Client"));
		});
		await waitFor(() =>
			expect(onSubmit).toHaveBeenCalledWith({
				client_name: "agent-1",
				scope: M2M_PERMITTED_SCOPES[0],
				token_lifetime: 3600,
			}),
		);
	});

	it("can toggle scope off after adding", () => {
		const { getByText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		expect(getByText(/At least one scope is required/)).toBeInTheDocument();
		const firstScopeCheckbox = document.getElementById(`scope-${M2M_PERMITTED_SCOPES[0]}`);
		if (firstScopeCheckbox) {
			fireEvent.click(firstScopeCheckbox);
			fireEvent.click(firstScopeCheckbox);
		}
		expect(getByText(/At least one scope is required/)).toBeInTheDocument();
	});

	it("allows normal token lifetime value entry", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const { getByText, getByLabelText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={onSubmit} />);
		fireEvent.change(getByLabelText(/Client Name/), { target: { value: "a" } });
		const firstScopeCheckbox = document.getElementById(`scope-${M2M_PERMITTED_SCOPES[0]}`);
		if (firstScopeCheckbox) fireEvent.click(firstScopeCheckbox);
		fireEvent.change(getByLabelText(/Token Lifetime/), { target: { value: "500" } });
		await act(async () => {
			fireEvent.click(getByText("Create Client"));
		});
		await waitFor(() => expect(onSubmit).toHaveBeenCalled());
	});

	it("shows error alert when passed", () => {
		const { getByText } = render(
			<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} error={new Error("API down")} />,
		);
		expect(getByText("API down")).toBeInTheDocument();
	});

	it("Cancel button fires onOpenChange(false)", () => {
		const onOpenChange = vi.fn();
		const { getByText } = render(<CreateM2MClientModal open={true} onOpenChange={onOpenChange} onSubmit={async () => {}} />);
		fireEvent.click(getByText("Cancel"));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("shows Creating... while submitting", () => {
		const { getByText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} isSubmitting={true} />);
		expect(getByText(/Creating/)).toBeInTheDocument();
	});

	it("renders lifetime preview for 300 seconds (recommended)", () => {
		const { getByLabelText, getByText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		fireEvent.change(getByLabelText(/Token Lifetime/), { target: { value: "300" } });
		expect(getByText(/5 minutes/)).toBeInTheDocument();
	});

	it("renders lifetime preview for short seconds", () => {
		const { getByLabelText, getByText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		fireEvent.change(getByLabelText(/Token Lifetime/), { target: { value: "45" } });
		expect(getByText(/45 seconds/)).toBeInTheDocument();
	});

	it("renders lifetime preview for minutes + seconds", () => {
		const { getByLabelText, getByText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		fireEvent.change(getByLabelText(/Token Lifetime/), { target: { value: "75" } });
		expect(getByText(/1m 15s/)).toBeInTheDocument();
	});

	it("renders lifetime preview for multiple minutes (no seconds remainder)", () => {
		const { getByLabelText, getByText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		fireEvent.change(getByLabelText(/Token Lifetime/), { target: { value: "600" } });
		expect(getByText(/10 minutes/)).toBeInTheDocument();
	});

	it("renders lifetime preview for hours (plural 's')", () => {
		const { getByLabelText, getByText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		fireEvent.change(getByLabelText(/Token Lifetime/), { target: { value: "7200" } });
		// 7200 / 3600 = 2 → "2 hours" (plural "s") branch
		expect(getByText(/2 hours/)).toBeInTheDocument();
	});

	it("renders lifetime preview for exactly 1 hour after threshold (singular 'hour')", () => {
		const { getByLabelText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		// 3601 seconds — enters the `return hour${...}` branch with count===1 → no plural "s"
		fireEvent.change(getByLabelText(/Token Lifetime/), { target: { value: "3601" } });
		// Should render "1 hour" (no 's') since Math.floor(3601/3600) = 1
		// Search globally — preview renders inside Radix Dialog portal
		expect(document.body.textContent).toMatch(/1 hour(?!s)/);
	});

	it("emits analytics event on scope selection", () => {
		const analyticsFn = vi.fn();
		(window as unknown as Record<string, unknown>).__olympus_analytics = analyticsFn;
		render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		const firstScopeCheckbox = document.getElementById(`scope-${M2M_PERMITTED_SCOPES[0]}`);
		if (firstScopeCheckbox) fireEvent.click(firstScopeCheckbox);
		expect(analyticsFn).toHaveBeenCalled();
		delete (window as unknown as Record<string, unknown>).__olympus_analytics;
	});

	it("resets form when open toggles false (useEffect branch)", () => {
		const { rerender } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		// Toggle modal closed — useEffect fires reset()
		rerender(<CreateM2MClientModal open={false} onOpenChange={() => {}} onSubmit={async () => {}} />);
		// Toggle back open
		rerender(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		// Client name should have been reset
		const input = document.getElementById("m2m-client-name") as HTMLInputElement;
		expect(input?.value).toBe("");
	});

	it("submit is a no-op when no scopes are selected", async () => {
		const onSubmit = vi.fn();
		const { getByText, getByLabelText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={onSubmit} />);
		// Add a client name but no scopes
		fireEvent.change(getByLabelText(/Client Name/), { target: { value: "a" } });
		// Create Client button is disabled when no scopes selected — clicking it
		// does nothing because the form validation rejects via early return
		await act(async () => {
			fireEvent.click(getByText("Create Client"));
		});
		// onSubmit should NOT have been called
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("renders empty lifetime preview when value is 0", () => {
		const { getByLabelText, queryByText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		fireEvent.change(getByLabelText(/Token Lifetime/), { target: { value: "0" } });
		// getLifetimePreview returns "" for 0 — so "= " prefix should not appear
		// The tokenLifetime watcher renders preview only when tokenLifetime > 0, so we check absence
		expect(queryByText(/=\s/)).toBeNull();
	});

	it("shows token_lifetime error when value exceeds max", async () => {
		const onSubmit = vi.fn();
		const { getByLabelText, getByText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={onSubmit} />);
		fireEvent.change(getByLabelText(/Client Name/), { target: { value: "x" } });
		const firstScopeCheckbox = document.getElementById(`scope-${M2M_PERMITTED_SCOPES[0]}`);
		if (firstScopeCheckbox) fireEvent.click(firstScopeCheckbox);
		// Enter a value > max (3600) — validation should fail
		fireEvent.change(getByLabelText(/Token Lifetime/), { target: { value: "99999" } });
		// The form is rendered in a portal (Radix Dialog); query globally
		const form = document.querySelector("form#create-m2m-form") as HTMLFormElement;
		if (form) {
			await act(async () => {
				fireEvent.submit(form);
			});
			// Wait for error message
			await waitFor(() => expect(document.body.textContent).toMatch(/Maximum is 3600 seconds/));
		} else {
			// Fallback: click Create Client
			await act(async () => {
				fireEvent.click(getByText("Create Client"));
			});
			await waitFor(() => expect(document.body.textContent).toMatch(/Maximum is 3600 seconds/));
		}
	});
});
