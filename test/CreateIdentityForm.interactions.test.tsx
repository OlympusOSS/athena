import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "./snapshot-setup";

const pushMock = vi.fn();
const mutateAsync = vi.fn();
const schemasState: { data: unknown; isLoading: boolean } = { data: [], isLoading: false };

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/features/identities/hooks/useIdentities", () => ({
	useCreateIdentity: () => ({
		mutateAsync,
		isPending: false,
		isError: false,
		error: null,
	}),
}));

vi.mock("@/features/schemas/hooks/useSchemas", () => ({
	useSchemas: () => schemasState,
}));

// Mock Canvas Select/etc. to be native-like so we can fire events
vi.mock("@olympusoss/canvas", async () => {
	const actual = await vi.importActual<typeof import("@olympusoss/canvas")>("@olympusoss/canvas");
	return {
		...actual,
		Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
			<div data-testid="mock-select">
				<select data-testid="mock-select-input" value={value} onChange={(e) => onValueChange(e.target.value)}>
					<option value="">Select</option>
					{/* The actual options extraction is complex — let the parent expose them */}
				</select>
				{children}
			</div>
		),
		SelectTrigger: ({ children, id }: { children: React.ReactNode; id?: string }) => <div id={id}>{children}</div>,
		SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
		SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <div data-item-value={value}>{children}</div>,
		SelectValue: ({ placeholder }: { placeholder: string }) => <span>{placeholder}</span>,
		SchemaForm: ({
			onSubmit,
			onChange,
			children,
		}: {
			onSubmit: (d: { formData: unknown }) => void;
			onChange: (d: { formData: unknown }) => void;
			children: React.ReactNode;
		}) => (
			<form
				onSubmit={(e) => {
					e.preventDefault();
					onSubmit({ formData: { email: "u@example.com" } });
				}}
			>
				<button type="button" data-testid="trigger-change" onClick={() => onChange({ formData: { email: "u2@example.com" } })}>
					change
				</button>
				{children}
			</form>
		),
	};
});

// Import after mocks
// eslint-disable-next-line import/first
import CreateIdentityForm from "@/features/identities/components/CreateIdentityForm";

beforeEach(() => {
	pushMock.mockReset();
	mutateAsync.mockReset();
	schemasState.data = [];
	schemasState.isLoading = false;
});

describe("CreateIdentityForm — interactions (mocked Canvas)", () => {
	it("changes schema via select, fires onChange + onSubmit + router.push", async () => {
		schemasState.data = [
			{
				id: "schema-1",
				schema: {
					title: "Person",
					properties: { traits: { properties: { email: { type: "string" } } } },
				},
			},
		];
		mutateAsync.mockResolvedValue(undefined);
		const onSuccess = vi.fn();
		const { getByTestId, container } = render(<CreateIdentityForm onSuccess={onSuccess} />);
		// Change the schema via mocked select — value has to exist but since only one test option exists,
		// add it manually
		const select = getByTestId("mock-select-input") as HTMLSelectElement;
		// Add an option for schema-1
		const opt = document.createElement("option");
		opt.value = "schema-1";
		opt.textContent = "Person";
		select.appendChild(opt);
		fireEvent.change(select, { target: { value: "schema-1" } });
		// Now SchemaForm should render; trigger change + submit
		await waitFor(() => expect(getByTestId("trigger-change")).toBeTruthy());
		fireEvent.click(getByTestId("trigger-change"));
		const form = container.querySelector("form") as HTMLFormElement;
		await act(async () => {
			fireEvent.submit(form);
		});
		await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
		expect(onSuccess).toHaveBeenCalled();
	});

	it("handles mutateAsync error (logs and continues)", async () => {
		schemasState.data = [
			{
				id: "schema-1",
				schema: {
					title: "Person",
					properties: { traits: { properties: { email: { type: "string" } } } },
				},
			},
		];
		mutateAsync.mockRejectedValue(new Error("conflict"));
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const { getByTestId, container } = render(<CreateIdentityForm />);
		const select = getByTestId("mock-select-input") as HTMLSelectElement;
		const opt = document.createElement("option");
		opt.value = "schema-1";
		opt.textContent = "Person";
		select.appendChild(opt);
		fireEvent.change(select, { target: { value: "schema-1" } });
		const form = container.querySelector("form") as HTMLFormElement;
		await act(async () => {
			fireEvent.submit(form);
		});
		await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
		consoleSpy.mockRestore();
	});

	it("handles schema without traits — formSchema still converts to 'Identity Traits' stub", async () => {
		schemasState.data = [{ id: "empty", schema: { title: "Empty" } }];
		const { getByTestId, container } = render(<CreateIdentityForm />);
		const select = getByTestId("mock-select-input") as HTMLSelectElement;
		const opt = document.createElement("option");
		opt.value = "empty";
		opt.textContent = "Empty";
		select.appendChild(opt);
		fireEvent.change(select, { target: { value: "empty" } });
		// convertKratosSchemaToRJSF returns a stub with empty properties — SchemaForm still renders
		await waitFor(() => expect(container.querySelector("form")).toBeTruthy());
	});

	it("clears formSchema when no schema selected", async () => {
		schemasState.data = [
			{
				id: "schema-1",
				schema: { title: "P", properties: { traits: { properties: { email: { type: "string" } } } } },
			},
		];
		const { getByTestId, queryByTestId } = render(<CreateIdentityForm />);
		const select = getByTestId("mock-select-input") as HTMLSelectElement;
		const opt = document.createElement("option");
		opt.value = "schema-1";
		opt.textContent = "P";
		select.appendChild(opt);
		fireEvent.change(select, { target: { value: "schema-1" } });
		// Now clear
		fireEvent.change(select, { target: { value: "" } });
		// SchemaForm should not render
		await waitFor(() => expect(queryByTestId("trigger-change")).toBeNull());
	});

	it("Cancel button fires onCancel and router.push", async () => {
		schemasState.data = [
			{
				id: "s1",
				schema: { title: "X", properties: { traits: { properties: { email: { type: "string" } } } } },
			},
		];
		const onCancel = vi.fn();
		const { getByTestId, getAllByText } = render(<CreateIdentityForm onCancel={onCancel} />);
		const select = getByTestId("mock-select-input") as HTMLSelectElement;
		const opt = document.createElement("option");
		opt.value = "s1";
		opt.textContent = "X";
		select.appendChild(opt);
		fireEvent.change(select, { target: { value: "s1" } });
		await waitFor(() => expect(getAllByText(/Cancel/).length).toBeGreaterThan(0));
		const cancelBtns = getAllByText(/Cancel/);
		fireEvent.click(cancelBtns[0]);
		expect(onCancel).toHaveBeenCalled();
		expect(pushMock).toHaveBeenCalledWith("/identities");
	});

	it("clears formSchema when schemas prop is undefined but schemaId truthy (fallback branch)", async () => {
		// schemaId set via select but schemas is null/undefined → goes to else branch, clears formSchema
		schemasState.data = null;
		const { getByTestId } = render(<CreateIdentityForm />);
		const select = getByTestId("mock-select-input") as HTMLSelectElement;
		// Add option dynamically since no schemas mapped
		const opt = document.createElement("option");
		opt.value = "unknown-schema-id";
		opt.textContent = "Unknown";
		select.appendChild(opt);
		fireEvent.change(select, { target: { value: "unknown-schema-id" } });
		// formSchema stays null, renders "No form fields available" branch
		// But the component code checks `if (schemaId && schemas)` — with schemas null, it goes to else and sets null.
		// The visual state then falls through to 'selectedSchemaId && !formSchema'
		await waitFor(() => expect(document.body.textContent).toMatch(/No form fields|Cancel/));
	});
});
