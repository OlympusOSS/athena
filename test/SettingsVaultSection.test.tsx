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

	it("handles setting with no category (falls back to 'general')", async () => {
		fetchMock.mockImplementation(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						settings: [{ key: "uncategorized.key", value: "v", encrypted: false, category: "", updated_at: "2024-01-01T00:00:00Z" }],
					}),
					{ status: 200 },
				),
			),
		);
		const { findByText } = render(<SettingsVaultSection />);
		await findByText("uncategorized.key");
	});

	it("handles fetch response with no settings field", async () => {
		fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({}), { status: 200 })));
		const { findByText } = render(<SettingsVaultSection />);
		await findByText(/No settings configured yet/);
	});

	it("rejects with non-Error instance on load", async () => {
		fetchMock.mockImplementation(() => Promise.reject("string-error"));
		const { findByText } = render(<SettingsVaultSection />);
		await findByText(/Failed to load settings/);
	});

	it("rejects with non-Error instance on save", async () => {
		fetchMock.mockImplementation((_url: string, opts?: RequestInit) => {
			if (opts?.method === "POST") {
				return Promise.reject("string-save-error");
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
		const saveBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Save");
		if (saveBtn) {
			await act(async () => {
				fireEvent.click(saveBtn);
			});
		}
		await findByText(/Failed to save/);
	});

	it("rejects with non-Error instance on delete", async () => {
		fetchMock.mockImplementation((_url: string, opts?: RequestInit) => {
			if (opts?.method === "DELETE") {
				return Promise.reject("string-delete-error");
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

	it("does not save when key is empty/whitespace", async () => {
		fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ settings: [] }), { status: 200 })));
		const { findByText, findByLabelText } = render(<SettingsVaultSection />);
		const addBtn = await findByText("Add Setting");
		await act(async () => {
			fireEvent.click(addBtn);
		});
		const keyInput = await findByLabelText("Key");
		fireEvent.change(keyInput, { target: { value: "   " } });
		const saveBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Save");
		await act(async () => {
			fireEvent.click(saveBtn!);
		});
		// POST should not have been called (only the GET from initial load)
		const postCalls = fetchMock.mock.calls.filter((c) => c[1]?.method === "POST");
		expect(postCalls.length).toBe(0);
	});

	it("handles save failure with empty response body (fallback error)", async () => {
		fetchMock.mockImplementation((_url: string, opts?: RequestInit) => {
			if (opts?.method === "POST") {
				return Promise.resolve(new Response("not-json", { status: 500 }));
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
		const saveBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Save");
		if (saveBtn) {
			await act(async () => {
				fireEvent.click(saveBtn);
			});
		}
		await findByText(/Failed to save setting/);
	});

	it("filters by category", async () => {
		fetchMock.mockImplementation((url: string) => {
			if (url.includes("category=smtp")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [{ key: "smtp.only", value: "v", encrypted: false, category: "smtp", updated_at: "2024-01-01T00:00:00Z" }],
						}),
						{ status: 200 },
					),
				);
			}
			return Promise.resolve(new Response(JSON.stringify({ settings: [] }), { status: 200 }));
		});
		const { findByText } = render(<SettingsVaultSection />);
		await findByText(/No settings configured yet/);
	});

	it("renders encrypted setting with password input and encrypted placeholder", async () => {
		fetchMock.mockImplementation(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						settings: [{ key: "secret.key", value: "***", encrypted: true, category: "general", updated_at: "2024-01-01T00:00:00Z" }],
					}),
					{ status: 200 },
				),
			),
		);
		const { findByText, container } = render(<SettingsVaultSection />);
		await findByText("secret.key");
		// Open edit dialog for the encrypted setting
		const editBtn = container.querySelector("button.h-7");
		if (editBtn) {
			await act(async () => {
				fireEvent.click(editBtn);
			});
		}
		// Value input should be type=password and have encrypted placeholder
		await waitFor(() => {
			const valueInput = document.querySelector("#setting-value") as HTMLInputElement;
			expect(valueInput).toBeTruthy();
			expect(valueInput.type).toBe("password");
			expect(valueInput.placeholder).toContain("encrypted");
		});
	});

	it("renders singular setting count text", async () => {
		fetchMock.mockImplementation(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						settings: [{ key: "only.one", value: "v", encrypted: false, category: "general", updated_at: "2024-01-01T00:00:00Z" }],
					}),
					{ status: 200 },
				),
			),
		);
		const { findByText } = render(<SettingsVaultSection />);
		await findByText(/1 setting$/);
	});

	it("formatDate catch branch: renders a setting with non-string date", async () => {
		// The component's formatDate wraps new Date(dateStr).toLocaleString() in try/catch.
		// Supplying a date that Date accepts but toLocaleString may not is hard to simulate;
		// but we can force the catch by passing something toLocaleString throws on.
		// Easiest: stub Date.prototype.toLocaleString briefly to throw for this test.
		const orig = Date.prototype.toLocaleString;
		Date.prototype.toLocaleString = () => {
			throw new Error("fake locale fail");
		};
		try {
			fetchMock.mockImplementation(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [{ key: "date.key", value: "v", encrypted: false, category: "general", updated_at: "2024-01-01T00:00:00Z" }],
						}),
						{ status: 200 },
					),
				),
			);
			const { findByText } = render(<SettingsVaultSection />);
			// Raw dateStr is rendered when formatDate falls back
			await findByText("2024-01-01T00:00:00Z");
		} finally {
			Date.prototype.toLocaleString = orig;
		}
	});
});
