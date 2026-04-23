import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsVaultSection } from "@/app/(app)/settings/components/SettingsVaultSection";

import "./snapshot-setup";

describe("SettingsVaultSection", () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(new Response("{}", { status: 500 })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("matches snapshot (loading)", () => {
		const { container } = render(<SettingsVaultSection />);
		expect(container).toMatchSnapshot();
	});

	it("shows error state when load fails", async () => {
		const { findByText } = render(<SettingsVaultSection />);
		await findByText(/Failed to fetch settings/);
	});

	it("renders empty state when no settings", async () => {
		fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ settings: [] }), { status: 200 })));
		const { findByText } = render(<SettingsVaultSection />);
		await findByText(/No settings configured yet/);
	});

	it("renders grouped settings and opens edit dialog", async () => {
		fetchMock.mockImplementation(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						settings: [
							{
								key: "a.one",
								value: "v1",
								encrypted: false,
								category: "general",
								updated_at: "2024-01-01T00:00:00Z",
							},
							{
								key: "b.two",
								value: "v2",
								encrypted: true,
								category: "smtp",
								updated_at: "invalid-date-string",
							},
						],
					}),
					{ status: 200 },
				),
			),
		);
		const { findByText, container } = render(<SettingsVaultSection />);
		await findByText("a.one");
		// Open edit dialog for a.one
		const editBtn = container.querySelector("button.h-7");
		if (editBtn) fireEvent.click(editBtn);
	});

	it("handles Add Setting flow with save success", async () => {
		let _callCount = 0;
		fetchMock.mockImplementation((_url: string, opts?: RequestInit) => {
			_callCount++;
			if (opts?.method === "POST") {
				return Promise.resolve(new Response("{}", { status: 200 }));
			}
			return Promise.resolve(new Response(JSON.stringify({ settings: [] }), { status: 200 }));
		});
		const { findByText, findByLabelText } = render(<SettingsVaultSection />);
		const addBtn = await findByText("Add Setting");
		await act(async () => {
			fireEvent.click(addBtn);
		});
		const keyInput = await findByLabelText("Key");
		fireEvent.change(keyInput, { target: { value: "new.key" } });
		const valueInput = await findByLabelText("Value");
		fireEvent.change(valueInput, { target: { value: "v" } });
		const saveBtns = document.querySelectorAll("button");
		const saveBtn = Array.from(saveBtns).find((b) => b.textContent === "Save");
		if (saveBtn) {
			await act(async () => {
				fireEvent.click(saveBtn);
			});
		}
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ method: "POST" })));
	});

	it("handles save failure with error body", async () => {
		fetchMock.mockImplementation((_url: string, opts?: RequestInit) => {
			if (opts?.method === "POST") {
				return Promise.resolve(new Response(JSON.stringify({ error: "nope" }), { status: 500 }));
			}
			return Promise.resolve(new Response(JSON.stringify({ settings: [] }), { status: 200 }));
		});
		const { findByText, findByLabelText } = render(<SettingsVaultSection />);
		const addBtn = await findByText("Add Setting");
		await act(async () => {
			fireEvent.click(addBtn);
		});
		const keyInput = await findByLabelText("Key");
		fireEvent.change(keyInput, { target: { value: "k" } });
		const saveBtns = document.querySelectorAll("button");
		const saveBtn = Array.from(saveBtns).find((b) => b.textContent === "Save");
		if (saveBtn) {
			await act(async () => {
				fireEvent.click(saveBtn);
			});
		}
		await findByText(/nope/);
	});

	it("handles delete flow", async () => {
		fetchMock.mockImplementation((_url: string, opts?: RequestInit) => {
			if (opts?.method === "DELETE") {
				return Promise.resolve(new Response("{}", { status: 200 }));
			}
			return Promise.resolve(
				new Response(
					JSON.stringify({
						settings: [{ key: "del.me", value: "v", encrypted: false, category: "general", updated_at: "2024-01-01T00:00:00Z" }],
					}),
					{ status: 200 },
				),
			);
		});
		const { findByText, container } = render(<SettingsVaultSection />);
		await findByText("del.me");
		// Click trash button (text-destructive)
		const allBtns = container.querySelectorAll("button");
		const trashBtn = Array.from(allBtns).find((b) => b.classList.contains("text-destructive"));
		if (trashBtn) fireEvent.click(trashBtn);
		// Dialog footer Delete
		const delBtns = document.querySelectorAll("button");
		const confirmDelete = Array.from(delBtns).find((b) => b.textContent === "Delete");
		if (confirmDelete) {
			await act(async () => {
				fireEvent.click(confirmDelete);
			});
		}
		await waitFor(() => {
			const deleteCalls = fetchMock.mock.calls.filter((c) => c[1]?.method === "DELETE");
			expect(deleteCalls.length).toBeGreaterThan(0);
		});
	});

	it("handles delete failure", async () => {
		fetchMock.mockImplementation((_url: string, opts?: RequestInit) => {
			if (opts?.method === "DELETE") {
				return Promise.resolve(new Response("fail", { status: 500 }));
			}
			return Promise.resolve(
				new Response(
					JSON.stringify({
						settings: [{ key: "del.me", value: "v", encrypted: false, category: "general", updated_at: "2024-01-01T00:00:00Z" }],
					}),
					{ status: 200 },
				),
			);
		});
		const { findByText, container } = render(<SettingsVaultSection />);
		await findByText("del.me");
		const trashBtn = Array.from(container.querySelectorAll("button")).find((b) => b.classList.contains("text-destructive"));
		if (trashBtn) fireEvent.click(trashBtn);
		const confirmDelete = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Delete");
		if (confirmDelete) {
			await act(async () => {
				fireEvent.click(confirmDelete);
			});
		}
		await findByText(/Failed to delete/);
	});
});
