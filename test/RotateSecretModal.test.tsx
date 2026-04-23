import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RotateSecretModal } from "@/features/m2m-clients/components/RotateSecretModal";

import "./snapshot-setup";

describe("RotateSecretModal", () => {
	it("matches snapshot (open)", () => {
		const { baseElement } = render(
			<RotateSecretModal open={true} onOpenChange={() => {}} onConfirm={async () => {}} clientName="Test Client" clientId="test-id" />,
		);
		expect(baseElement).toMatchSnapshot();
	});

	it("calls onConfirm on Rotate Secret click", () => {
		const onConfirm = vi.fn();
		const { getByText } = render(<RotateSecretModal open={true} onOpenChange={() => {}} onConfirm={onConfirm} clientId="id" />);
		fireEvent.click(getByText("Rotate Secret"));
		expect(onConfirm).toHaveBeenCalled();
	});

	it("calls onOpenChange(false) on Cancel", () => {
		const onOpenChange = vi.fn();
		const { getByText } = render(<RotateSecretModal open={true} onOpenChange={onOpenChange} onConfirm={async () => {}} clientId="id" />);
		fireEvent.click(getByText("Cancel"));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("falls back to clientId when clientName absent", () => {
		const { getByText } = render(<RotateSecretModal open={true} onOpenChange={() => {}} onConfirm={async () => {}} clientId="only-id" />);
		expect(getByText(/only-id/)).toBeInTheDocument();
	});

	it("shows Rotating... while isRotating", () => {
		const { getByText } = render(
			<RotateSecretModal open={true} onOpenChange={() => {}} onConfirm={async () => {}} clientId="id" isRotating={true} />,
		);
		expect(getByText(/Rotating/)).toBeInTheDocument();
	});

	it("shows error alert when error prop passed", () => {
		const { getByText } = render(
			<RotateSecretModal open={true} onOpenChange={() => {}} onConfirm={async () => {}} clientId="id" error={new Error("oops")} />,
		);
		expect(getByText("oops")).toBeInTheDocument();
	});
});
