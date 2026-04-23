import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeleteM2MClientModal } from "@/features/m2m-clients/components/DeleteM2MClientModal";

import "./snapshot-setup";

describe("DeleteM2MClientModal", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(
			<DeleteM2MClientModal open={true} onOpenChange={() => {}} onConfirm={async () => {}} clientName="Test Client" clientId="test-id" />,
		);
		expect(baseElement).toMatchSnapshot();
	});

	it("calls onConfirm when Delete Client button clicked", () => {
		const onConfirm = vi.fn();
		const { getByText } = render(<DeleteM2MClientModal open={true} onOpenChange={() => {}} onConfirm={onConfirm} clientName="X" clientId="id" />);
		fireEvent.click(getByText("Delete Client"));
		expect(onConfirm).toHaveBeenCalled();
	});

	it("calls onOpenChange(false) when Cancel clicked", () => {
		const onOpenChange = vi.fn();
		const { getByText } = render(
			<DeleteM2MClientModal open={true} onOpenChange={onOpenChange} onConfirm={async () => {}} clientName="X" clientId="id" />,
		);
		fireEvent.click(getByText("Cancel"));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("falls back to clientId when no name", () => {
		const { getByText } = render(<DeleteM2MClientModal open={true} onOpenChange={() => {}} onConfirm={async () => {}} clientId="only-id-123" />);
		expect(getByText(/only-id-123/)).toBeInTheDocument();
	});

	it("shows Deleting... while isDeleting true", () => {
		const { getAllByText } = render(
			<DeleteM2MClientModal open={true} onOpenChange={() => {}} onConfirm={async () => {}} clientId="id" isDeleting={true} />,
		);
		expect(getAllByText(/Deleting/).length).toBeGreaterThan(0);
	});

	it("shows error alert when error prop passed", () => {
		const { getByText } = render(
			<DeleteM2MClientModal open={true} onOpenChange={() => {}} onConfirm={async () => {}} clientId="id" error={new Error("blocked")} />,
		);
		expect(getByText("blocked")).toBeInTheDocument();
	});
});
