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

	it("renders lifetime preview for hours", () => {
		const { getByLabelText, getByText } = render(<CreateM2MClientModal open={true} onOpenChange={() => {}} onSubmit={async () => {}} />);
		fireEvent.change(getByLabelText(/Token Lifetime/), { target: { value: "7200" } });
		// Though it's clamped to 3600 in HTML input, the value can still be read
		// but max val 7200 exceeds 3600; test path requires a lifetime > 3600
		expect(getByText(/hour/i)).toBeInTheDocument();
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
});
