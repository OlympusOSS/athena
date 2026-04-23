import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OAuthConfigSection } from "@/app/(app)/settings/components/OAuthConfigSection";

import "./snapshot-setup";

describe("OAuthConfigSection", () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(new Response("{}", { status: 500 })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("matches snapshot (loading)", () => {
		const { container } = render(<OAuthConfigSection />);
		expect(container).toMatchSnapshot();
	});

	it("shows error on load failure", async () => {
		const { findByText } = render(<OAuthConfigSection />);
		await findByText(/Failed to load OAuth settings/);
	});

	it("saves on client id / secret blur", async () => {
		fetchMock.mockImplementation((_url: string, opts?: RequestInit) => {
			if (opts?.method === "POST") {
				return Promise.resolve(new Response("{}", { status: 200 }));
			}
			return Promise.resolve(
				new Response(
					JSON.stringify({
						settings: [
							{ key: "oauth.client_id", value: "id-1" },
							{ key: "oauth.client_secret", value: "s-1" },
						],
					}),
					{ status: 200 },
				),
			);
		});
		const { container } = render(<OAuthConfigSection />);
		await waitFor(() => expect(container.querySelector("#oauth-client-id")).toBeTruthy());
		const idInput = container.querySelector("#oauth-client-id") as HTMLInputElement;
		fireEvent.change(idInput, { target: { value: "new-id" } });
		await act(async () => {
			fireEvent.blur(idInput);
		});
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ method: "POST" })));
		const secretInput = container.querySelector("#oauth-client-secret") as HTMLInputElement;
		fireEvent.change(secretInput, { target: { value: "new-secret" } });
		await act(async () => {
			fireEvent.blur(secretInput);
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
		const { container, findByText } = render(<OAuthConfigSection />);
		await waitFor(() => expect(container.querySelector("#oauth-client-id")).toBeTruthy());
		const idInput = container.querySelector("#oauth-client-id") as HTMLInputElement;
		fireEvent.change(idInput, { target: { value: "x" } });
		await act(async () => {
			fireEvent.blur(idInput);
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
			return Promise.reject("str-err");
		});
		const { container, findByText } = render(<OAuthConfigSection />);
		await waitFor(() => expect(container.querySelector("#oauth-client-id")).toBeTruthy());
		const idInput = container.querySelector("#oauth-client-id") as HTMLInputElement;
		fireEvent.change(idInput, { target: { value: "x" } });
		await act(async () => {
			fireEvent.blur(idInput);
		});
		await findByText(/Failed to save/);
	});
});
