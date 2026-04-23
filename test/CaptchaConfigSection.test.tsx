import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CaptchaConfigSection } from "@/app/(app)/settings/components/CaptchaConfigSection";

import "./snapshot-setup";

describe("CaptchaConfigSection", () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(new Response("{}", { status: 500 })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("matches snapshot (loading)", () => {
		const { container } = render(<CaptchaConfigSection />);
		expect(container).toMatchSnapshot();
	});

	it("shows error when fetch fails", async () => {
		const { findByText } = render(<CaptchaConfigSection />);
		await findByText(/Failed to load CAPTCHA settings/);
	});

	it("loads settings and allows toggling enabled", async () => {
		fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
			if (opts?.method === "POST") {
				return Promise.resolve(new Response("{}", { status: 200 }));
			}
			return Promise.resolve(
				new Response(
					JSON.stringify({
						settings: [
							{ key: "captcha.enabled", value: "false" },
							{ key: "captcha.site_key", value: "abc" },
							{ key: "captcha.secret_key", value: "xyz" },
						],
					}),
					{ status: 200 },
				),
			);
		});
		const { findByRole, container } = render(<CaptchaConfigSection />);
		const toggle = await findByRole("switch");
		await act(async () => {
			fireEvent.click(toggle);
		});
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ method: "POST" })));
		// Test input blur + save
		const siteKeyInput = container.querySelector("#captcha-site-key") as HTMLInputElement;
		fireEvent.change(siteKeyInput, { target: { value: "new-site-key" } });
		await act(async () => {
			fireEvent.blur(siteKeyInput);
		});
		const secretKeyInput = container.querySelector("#captcha-secret-key") as HTMLInputElement;
		fireEvent.change(secretKeyInput, { target: { value: "new-secret-key" } });
		await act(async () => {
			fireEvent.blur(secretKeyInput);
		});
	});

	it("shows error when save fails", async () => {
		let first = true;
		fetchMock.mockImplementation(() => {
			if (first) {
				first = false;
				return Promise.resolve(new Response(JSON.stringify({ settings: [] }), { status: 200 }));
			}
			return Promise.resolve(new Response("fail", { status: 500 }));
		});
		const { findByRole, findByText } = render(<CaptchaConfigSection />);
		const toggle = await findByRole("switch");
		await act(async () => {
			fireEvent.click(toggle);
		});
		await findByText(/Failed to save/);
	});

	it("handles thrown exception in save gracefully", async () => {
		let first = true;
		fetchMock.mockImplementation(() => {
			if (first) {
				first = false;
				return Promise.resolve(new Response(JSON.stringify({ settings: [] }), { status: 200 }));
			}
			return Promise.reject(new Error("net-err"));
		});
		const { findByRole, findByText } = render(<CaptchaConfigSection />);
		const toggle = await findByRole("switch");
		await act(async () => {
			fireEvent.click(toggle);
		});
		await findByText(/net-err/);
	});
});
