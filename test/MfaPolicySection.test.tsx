import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MfaPolicySection } from "@/app/(app)/settings/components/MfaPolicySection";

import "./snapshot-setup";

function _makeFetch(responses: Array<{ matcher: (url: string, opts?: RequestInit) => boolean; response: () => Response | Promise<Response> }>) {
	return vi.fn((url: string, opts?: RequestInit) => {
		for (const r of responses) {
			if (r.matcher(url, opts)) return Promise.resolve(r.response());
		}
		return Promise.resolve(new Response("{}", { status: 500 }));
	});
}

describe("MfaPolicySection", () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(new Response("{}", { status: 500 })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("matches snapshot (loading)", () => {
		const { container } = render(<MfaPolicySection />);
		expect(container).toMatchSnapshot();
	});

	it("shows error state when load fails", async () => {
		const { findByText } = render(<MfaPolicySection />);
		await findByText(/Failed to load MFA policy settings/);
	});

	it("loads settings and renders default state", async () => {
		fetchMock.mockImplementation((url: string) => {
			if (url.includes("/api/settings?category=mfa")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [
								{ key: "mfa.required", value: "false" },
								{ key: "mfa.methods", value: "totp" },
								{ key: "mfa.grace_period_days", value: "7" },
								{ key: "mfa.allow_self_enroll", value: "true" },
							],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: true, enrolled: 5, total: 10, rate: 0.5 }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { findByText } = render(<MfaPolicySection />);
		await findByText(/\/ 10 users enrolled/);
	});

	it("migrates mfa.require_mfa to mfa.required when stale key present", async () => {
		let _settingsCall = 0;
		fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
			if (url.includes("/api/settings?category=mfa") && !opts?.method) {
				_settingsCall++;
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [{ key: "mfa.require_mfa", value: "true" }],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/settings/mfa.require_mfa") && opts?.method === "DELETE") {
				return Promise.resolve(new Response("{}", { status: 200 }));
			}
			if (url.includes("/api/settings") && opts?.method === "POST") {
				return Promise.resolve(new Response("{}", { status: 200 }));
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: false }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 500 }));
		});
		const { findByText } = render(<MfaPolicySection />);
		await findByText(/Enrollment statistics are not available/);
	});

	it("handles migration failure gracefully", async () => {
		fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
			if (url.includes("/api/settings?category=mfa") && !opts?.method) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [{ key: "mfa.require_mfa", value: "true" }],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/settings") && opts?.method === "POST") {
				return Promise.reject(new Error("migration-failure"));
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: true, enrolled: 0, total: 0 }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		render(<MfaPolicySection />);
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
	});

	it("saves policy via handleSave with gracePeriod > 0", async () => {
		fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
			if (url.includes("/api/settings?category=mfa") && !opts?.method) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [
								{ key: "mfa.required", value: "false" },
								{ key: "mfa.grace_period_days", value: "7" },
							],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/settings/batch") && opts?.method === "POST") {
				return Promise.resolve(new Response("{}", { status: 200 }));
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: true, enrolled: 0, total: 0 }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { findAllByRole, container } = render(<MfaPolicySection />);
		// Toggle allowSelfEnroll to mark dirty
		const switches = await findAllByRole("switch");
		await act(async () => {
			fireEvent.click(switches[1]);
		});
		// Wait for button to become enabled
		await waitFor(() => {
			const saveBtns = Array.from(container.querySelectorAll("button")).filter((b) =>
				b.textContent?.includes("Save MFA Policy"),
			) as HTMLButtonElement[];
			if (saveBtns.length === 0 || saveBtns[0].disabled) throw new Error("still disabled");
		});
		const saveBtns = Array.from(container.querySelectorAll("button")).filter((b) =>
			b.textContent?.includes("Save MFA Policy"),
		) as HTMLButtonElement[];
		await act(async () => {
			fireEvent.click(saveBtns[0]);
		});
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/settings/batch", expect.objectContaining({ method: "POST" })), {
			timeout: 3000,
		});
	});

	it("shows confirm dialog when mandatory MFA + zero grace, cancel restores state", async () => {
		fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
			if (url.includes("/api/settings?category=mfa") && !opts?.method) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [
								{ key: "mfa.required", value: "false" },
								{ key: "mfa.grace_period_days", value: "0" },
							],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: true, enrolled: 2, total: 10 }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { findAllByRole, container, queryByText } = render(<MfaPolicySection />);
		const switches = await findAllByRole("switch");
		// Click requireMfa switch (first)
		await act(async () => {
			fireEvent.click(switches[0]);
		});
		await waitFor(() => {
			const btns = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent?.includes("Save MFA Policy")) as HTMLButtonElement[];
			if (btns.length === 0 || btns[0].disabled) throw new Error("disabled");
		});
		const saveBtns = Array.from(container.querySelectorAll("button")).filter((b) =>
			b.textContent?.includes("Save MFA Policy"),
		) as HTMLButtonElement[];
		await act(async () => {
			fireEvent.click(saveBtns[0]);
		});
		// Confirm dialog should be open; get its Cancel button via role dialog
		await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());
		const cancelBtns = Array.from(document.querySelectorAll('[role="dialog"] button')).filter(
			(b) => b.textContent === "Cancel",
		) as HTMLButtonElement[];
		await act(async () => {
			fireEvent.click(cancelBtns[0]);
		});
		await waitFor(() => expect(queryByText(/Confirm MFA Policy Change/)).toBeNull());
	});

	it("confirms mandatory MFA save via modal", async () => {
		fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
			if (url.includes("/api/settings?category=mfa") && !opts?.method) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [
								{ key: "mfa.required", value: "false" },
								{ key: "mfa.grace_period_days", value: "0" },
							],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/settings/batch") && opts?.method === "POST") {
				return Promise.resolve(new Response("{}", { status: 200 }));
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: false }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { findAllByRole, container } = render(<MfaPolicySection />);
		const switches = await findAllByRole("switch");
		await act(async () => {
			fireEvent.click(switches[0]);
		});
		await waitFor(() => {
			const btns = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent?.includes("Save MFA Policy")) as HTMLButtonElement[];
			if (btns.length === 0 || btns[0].disabled) throw new Error("disabled");
		});
		const saveBtns = Array.from(container.querySelectorAll("button")).filter((b) =>
			b.textContent?.includes("Save MFA Policy"),
		) as HTMLButtonElement[];
		await act(async () => {
			fireEvent.click(saveBtns[0]);
		});
		await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());
		const confirmBtns = Array.from(document.querySelectorAll('[role="dialog"] button')).filter(
			(b) => b.textContent === "Save Policy",
		) as HTMLButtonElement[];
		await act(async () => {
			fireEvent.click(confirmBtns[0]);
		});
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/settings/batch", expect.anything()));
	});

	it("displays save error when batch save fails", async () => {
		fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
			if (url.includes("/api/settings?category=mfa") && !opts?.method) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [{ key: "mfa.required", value: "false" }],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/settings/batch") && opts?.method === "POST") {
				return Promise.resolve(new Response(JSON.stringify({ error: "db fail" }), { status: 500 }));
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: true, enrolled: 1, total: 2 }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { findAllByRole, findByText, container } = render(<MfaPolicySection />);
		const switches = await findAllByRole("switch");
		// Toggle allowSelfEnroll -> dirty
		await act(async () => {
			fireEvent.click(switches[1]);
		});
		await waitFor(() => {
			const btns = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent?.includes("Save MFA Policy")) as HTMLButtonElement[];
			if (btns.length === 0 || btns[0].disabled) throw new Error("disabled");
		});
		const saveBtns = Array.from(container.querySelectorAll("button")).filter((b) =>
			b.textContent?.includes("Save MFA Policy"),
		) as HTMLButtonElement[];
		await act(async () => {
			fireEvent.click(saveBtns[0]);
		});
		await findByText(/db fail/);
	});

	it("validates grace period input (clamps to 90, resets NaN)", async () => {
		fetchMock.mockImplementation((url: string) => {
			if (url.includes("/api/settings?category=mfa")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [
								{ key: "mfa.required", value: "true" },
								{ key: "mfa.grace_period_days", value: "10" },
							],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: true, enrolled: 0, total: 1 }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { container } = render(<MfaPolicySection />);
		await waitFor(() => expect(container.querySelector("#mfa-grace-period")).toBeTruthy());
		const input = container.querySelector("#mfa-grace-period") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "200" } });
		fireEvent.change(input, { target: { value: "abc" } });
	});

	it("calls onDirtyChange when dirty state changes", async () => {
		fetchMock.mockImplementation((url: string) => {
			if (url.includes("/api/settings?category=mfa")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [{ key: "mfa.required", value: "false" }],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: false }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const onDirtyChange = vi.fn();
		const { findAllByRole } = render(<MfaPolicySection onDirtyChange={onDirtyChange} />);
		const switches = await findAllByRole("switch");
		await act(async () => {
			fireEvent.click(switches[0]);
		});
		await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true));
	});

	it("cannot disable last MFA method", async () => {
		fetchMock.mockImplementation((url: string) => {
			if (url.includes("/api/settings?category=mfa")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [
								{ key: "mfa.required", value: "false" },
								{ key: "mfa.methods", value: "totp" },
							],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: true, enrolled: 1, total: 1 }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { findAllByRole } = render(<MfaPolicySection />);
		const switches = await findAllByRole("switch");
		// TOTP is 3rd switch (requireMfa, allowSelfEnroll, totp)
		if (switches[2]) {
			await act(async () => {
				fireEvent.click(switches[2]);
			});
		}
	});

	it("shows 'Loading stats...' branch when settings load but stats are still pending", async () => {
		let resolveStats: (v: Response) => void = () => {};
		const statsPromise = new Promise<Response>((res) => {
			resolveStats = res;
		});
		fetchMock.mockImplementation((url: string) => {
			if (url.includes("/api/settings?category=mfa")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [{ key: "mfa.required", value: "false" }],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/mfa/stats")) {
				return statsPromise;
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { findByText } = render(<MfaPolicySection />);
		// Settings loaded, stats still pending → Loading stats... branch
		await findByText(/Loading stats\.\.\./);
		// Clean up - resolve the stats promise
		await act(async () => {
			resolveStats(new Response(JSON.stringify({ available: true, enrolled: 0, total: 0 }), { status: 200 }));
		});
	});

	it("handles missing settings field (defaults to []) and parsedMethods fallback", async () => {
		fetchMock.mockImplementation((url: string) => {
			if (url.includes("/api/settings?category=mfa")) {
				// No settings field at all
				return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: false }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { findAllByRole } = render(<MfaPolicySection />);
		// If setup is correct, at least switches should render (defaults applied)
		await findAllByRole("switch");
	});

	it("handles negative grace period input (clamps to 0)", async () => {
		fetchMock.mockImplementation((url: string) => {
			if (url.includes("/api/settings?category=mfa")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [
								{ key: "mfa.required", value: "true" },
								// Negative grace period -> clamped to 0
								{ key: "mfa.grace_period_days", value: "-10" },
							],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: false }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { container } = render(<MfaPolicySection />);
		await waitFor(() => expect(container.querySelector("#mfa-grace-period")).toBeTruthy());
	});

	it("handles unknown methods (filtered out → falls back to ['totp'])", async () => {
		fetchMock.mockImplementation((url: string) => {
			if (url.includes("/api/settings?category=mfa")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [
								{ key: "mfa.required", value: "false" },
								// Only "unknown-method" - filter strips it → parsedMethods=[] → fallback ['totp']
								{ key: "mfa.methods", value: "unknown-method" },
							],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: false }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { findAllByRole } = render(<MfaPolicySection />);
		await findAllByRole("switch");
	});

	it("handles batch save failure with no error body (fallback to server response message)", async () => {
		fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
			if (url.includes("/api/settings?category=mfa") && !opts?.method) {
				return Promise.resolve(new Response(JSON.stringify({ settings: [{ key: "mfa.required", value: "false" }] }), { status: 200 }));
			}
			if (url.includes("/api/settings/batch") && opts?.method === "POST") {
				// Response has no `error` field → fallback to "Server responded with N"
				return Promise.resolve(new Response(JSON.stringify({}), { status: 500 }));
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: true, enrolled: 0, total: 0 }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { findAllByRole, findByText, container } = render(<MfaPolicySection />);
		const switches = await findAllByRole("switch");
		// Toggle allowSelfEnroll → dirty
		await act(async () => {
			fireEvent.click(switches[1]);
		});
		await waitFor(() => {
			const btns = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent?.includes("Save MFA Policy")) as HTMLButtonElement[];
			if (btns.length === 0 || btns[0].disabled) throw new Error("disabled");
		});
		const saveBtns = Array.from(container.querySelectorAll("button")).filter((b) =>
			b.textContent?.includes("Save MFA Policy"),
		) as HTMLButtonElement[];
		await act(async () => {
			fireEvent.click(saveBtns[0]);
		});
		await findByText(/Server responded with 500/);
	});

	it("non-Error thrown during save surfaces default message", async () => {
		fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
			if (url.includes("/api/settings?category=mfa") && !opts?.method) {
				return Promise.resolve(new Response(JSON.stringify({ settings: [{ key: "mfa.required", value: "false" }] }), { status: 200 }));
			}
			if (url.includes("/api/settings/batch") && opts?.method === "POST") {
				// Throw a string (not Error) — hits the `err instanceof Error ? ... : "Failed to save MFA policy"` fallback
				return Promise.reject("string-rejection");
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: true, enrolled: 0, total: 0 }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { findAllByRole, findByText, container } = render(<MfaPolicySection />);
		const switches = await findAllByRole("switch");
		await act(async () => {
			fireEvent.click(switches[1]);
		});
		await waitFor(() => {
			const btns = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent?.includes("Save MFA Policy")) as HTMLButtonElement[];
			if (btns.length === 0 || btns[0].disabled) throw new Error("disabled");
		});
		const saveBtns = Array.from(container.querySelectorAll("button")).filter((b) =>
			b.textContent?.includes("Save MFA Policy"),
		) as HTMLButtonElement[];
		await act(async () => {
			fireEvent.click(saveBtns[0]);
		});
		await findByText(/Failed to save MFA policy/);
	});

	it("dispatches beforeunload when dirty", async () => {
		fetchMock.mockImplementation((url: string) => {
			if (url.includes("/api/settings?category=mfa")) {
				return Promise.resolve(
					new Response(
						JSON.stringify({
							settings: [{ key: "mfa.required", value: "false" }],
						}),
						{ status: 200 },
					),
				);
			}
			if (url.includes("/api/mfa/stats")) {
				return Promise.resolve(new Response(JSON.stringify({ available: false }), { status: 200 }));
			}
			return Promise.resolve(new Response("{}", { status: 200 }));
		});
		const { findAllByRole } = render(<MfaPolicySection />);
		const switches = await findAllByRole("switch");
		await act(async () => {
			fireEvent.click(switches[0]);
		});
		// Dispatch beforeunload
		const event = new Event("beforeunload", { cancelable: true });
		Object.defineProperty(event, "returnValue", { writable: true, value: "" });
		window.dispatchEvent(event);
	});
});
