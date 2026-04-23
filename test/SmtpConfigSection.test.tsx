import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SmtpConfigSection } from "@/app/(app)/settings/components/SmtpConfigSection";

import "./snapshot-setup";

describe("SmtpConfigSection", () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(new Response("{}", { status: 500 })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("matches snapshot (loading)", () => {
		const { container } = render(<SmtpConfigSection />);
		expect(container).toMatchSnapshot();
	});

	it("shows error on load failure", async () => {
		const { findByText } = render(<SmtpConfigSection />);
		await findByText(/Failed to load SMTP settings/);
	});

	it("allows blur-save for all three fields", async () => {
		fetchMock.mockImplementation((_url: string, opts?: RequestInit) => {
			if (opts?.method === "POST") {
				return Promise.resolve(new Response("{}", { status: 200 }));
			}
			return Promise.resolve(
				new Response(
					JSON.stringify({
						settings: [
							{ key: "smtp.connection_uri", value: "smtps://old" },
							{ key: "smtp.from_email", value: "old@example.com" },
							{ key: "smtp.api_key", value: "re_old" },
						],
					}),
					{ status: 200 },
				),
			);
		});
		const { container } = render(<SmtpConfigSection />);
		await waitFor(() => expect(container.querySelector("#smtp-uri")).toBeTruthy());
		const uri = container.querySelector("#smtp-uri") as HTMLInputElement;
		fireEvent.change(uri, { target: { value: "smtps://new" } });
		await act(async () => {
			fireEvent.blur(uri);
		});
		const from = container.querySelector("#smtp-from") as HTMLInputElement;
		fireEvent.change(from, { target: { value: "new@example.com" } });
		await act(async () => {
			fireEvent.blur(from);
		});
		const key = container.querySelector("#smtp-apikey") as HTMLInputElement;
		fireEvent.change(key, { target: { value: "re_new" } });
		await act(async () => {
			fireEvent.blur(key);
		});
		await waitFor(() => {
			const postCalls = fetchMock.mock.calls.filter((c) => c[1]?.method === "POST");
			expect(postCalls.length).toBeGreaterThan(0);
		});
	});

	it("shows error on save failure", async () => {
		let first = true;
		fetchMock.mockImplementation(() => {
			if (first) {
				first = false;
				return Promise.resolve(new Response(JSON.stringify({ settings: [] }), { status: 200 }));
			}
			return Promise.resolve(new Response("fail", { status: 500 }));
		});
		const { container, findByText } = render(<SmtpConfigSection />);
		await waitFor(() => expect(container.querySelector("#smtp-from")).toBeTruthy());
		const from = container.querySelector("#smtp-from") as HTMLInputElement;
		fireEvent.change(from, { target: { value: "y@example.com" } });
		await act(async () => {
			fireEvent.blur(from);
		});
		await findByText(/Failed to save/);
	});

	it("handles non-Error rejection", async () => {
		let first = true;
		fetchMock.mockImplementation(() => {
			if (first) {
				first = false;
				return Promise.resolve(new Response(JSON.stringify({ settings: [] }), { status: 200 }));
			}
			return Promise.reject("xxx");
		});
		const { container, findByText } = render(<SmtpConfigSection />);
		await waitFor(() => expect(container.querySelector("#smtp-from")).toBeTruthy());
		const from = container.querySelector("#smtp-from") as HTMLInputElement;
		fireEvent.change(from, { target: { value: "y@example.com" } });
		await act(async () => {
			fireEvent.blur(from);
		});
		await findByText(/Failed to save/);
	});
});
