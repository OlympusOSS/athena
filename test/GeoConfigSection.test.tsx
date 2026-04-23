import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GeoConfigSection } from "@/app/(app)/settings/components/GeoConfigSection";

import "./snapshot-setup";

describe("GeoConfigSection", () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		fetchMock = vi.fn(() => Promise.resolve(new Response("{}", { status: 500 })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("matches snapshot (loading)", () => {
		const { container } = render(<GeoConfigSection />);
		expect(container).toMatchSnapshot();
	});

	it("shows error when fetch fails", async () => {
		const { findByText } = render(<GeoConfigSection />);
		await findByText(/Failed to load geolocation settings/);
	});

	it("loads with geo enabled and toggles mandatory + saves endpoint", async () => {
		fetchMock.mockImplementation((_url: string, opts?: RequestInit) => {
			if (opts?.method === "POST") {
				return Promise.resolve(new Response("{}", { status: 200 }));
			}
			return Promise.resolve(
				new Response(
					JSON.stringify({
						settings: [
							{ key: "geo.enabled", value: "true" },
							{ key: "geo.mandatory", value: "false" },
							{ key: "geo.endpoint", value: "http://api.example.com" },
						],
					}),
					{ status: 200 },
				),
			);
		});
		const { findAllByRole, findByText, container } = render(<GeoConfigSection />);
		const switches = await findAllByRole("switch");
		expect(switches.length).toBeGreaterThan(0);
		// Click mandatory switch
		if (switches[1]) {
			await act(async () => {
				fireEvent.click(switches[1]);
			});
		}
		// Modify endpoint and save
		const endpointInput = container.querySelector("#geo-endpoint") as HTMLInputElement;
		fireEvent.change(endpointInput, { target: { value: "http://new.example.com" } });
		const saveBtn = await findByText("Save Endpoint");
		await act(async () => {
			fireEvent.click(saveBtn);
		});
		await waitFor(() => {
			const postCalls = fetchMock.mock.calls.filter((c) => c[1]?.method === "POST");
			expect(postCalls.length).toBeGreaterThan(0);
		});
	});

	it("disables mandatory when main enable toggled off (saves geo.mandatory=false)", async () => {
		fetchMock.mockImplementation((_url: string, opts?: RequestInit) => {
			if (opts?.method === "POST") {
				return Promise.resolve(new Response("{}", { status: 200 }));
			}
			return Promise.resolve(
				new Response(
					JSON.stringify({
						settings: [
							{ key: "geo.enabled", value: "true" },
							{ key: "geo.mandatory", value: "true" },
						],
					}),
					{ status: 200 },
				),
			);
		});
		const { findAllByRole } = render(<GeoConfigSection />);
		const switches = await findAllByRole("switch");
		await act(async () => {
			fireEvent.click(switches[0]);
		});
		await waitFor(() => {
			const postCalls = fetchMock.mock.calls.filter((c) => c[1]?.method === "POST");
			expect(postCalls.length).toBeGreaterThanOrEqual(2);
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
		const { findAllByRole, findByText } = render(<GeoConfigSection />);
		const switches = await findAllByRole("switch");
		await act(async () => {
			fireEvent.click(switches[0]);
		});
		await findByText(/Failed to save/);
	});

	it("handles non-Error rejection in save", async () => {
		let first = true;
		fetchMock.mockImplementation(() => {
			if (first) {
				first = false;
				return Promise.resolve(new Response(JSON.stringify({ settings: [] }), { status: 200 }));
			}
			return Promise.reject("string-err");
		});
		const { findAllByRole, findByText } = render(<GeoConfigSection />);
		const switches = await findAllByRole("switch");
		await act(async () => {
			fireEvent.click(switches[0]);
		});
		await findByText(/Failed to save/);
	});
});
