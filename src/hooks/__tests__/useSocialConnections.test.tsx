/**
 * Unit tests for hooks/useSocialConnections (TanStack Query hooks).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React, { type PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateSocialConnection, useDeleteSocialConnection, useSocialConnections, useToggleSocialConnection } from "../useSocialConnections";

function wrapperFactory() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
	const Wrapper: React.FC<PropsWithChildren> = ({ children }) => React.createElement(QueryClientProvider, { client: queryClient }, children);
	return { Wrapper, queryClient };
}

describe("useSocialConnections (GET)", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("fetches and returns connections on success", async () => {
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ connections: [{ provider: "google" }] }), { status: 200 }));
		const { Wrapper } = wrapperFactory();
		const { result } = renderHook(() => useSocialConnections(), { wrapper: Wrapper });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.connections[0].provider).toBe("google");
		expect(fetchMock).toHaveBeenCalledWith("/api/connections/social");
	});

	it("throws with API-provided error message on non-ok", async () => {
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "nope" }), { status: 500 }));
		const { Wrapper } = wrapperFactory();
		const { result } = renderHook(() => useSocialConnections(), { wrapper: Wrapper });
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error?.message).toBe("nope");
	});

	it("uses fallback error message when body.json() rejects", async () => {
		const resp = new Response("not-json", { status: 500 });
		// Replace json to throw
		Object.defineProperty(resp, "json", { value: () => Promise.reject(new Error("parse")) });
		fetchMock.mockResolvedValue(resp);
		const { Wrapper } = wrapperFactory();
		const { result } = renderHook(() => useSocialConnections(), { wrapper: Wrapper });
		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error?.message).toContain("500");
	});
});

describe("useCreateSocialConnection (POST)", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("POSTs payload and invalidates the connections list", async () => {
		const payload = { provider: "google", client_id: "id", client_secret: "s", enabled: true };
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ success: true, provider: "google", secretChanged: true, reloadStatus: "skipped" }), {
				status: 200,
			}),
		);
		const { Wrapper, queryClient } = wrapperFactory();
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(() => useCreateSocialConnection(), { wrapper: Wrapper });
		await act(async () => {
			await result.current.mutateAsync(payload);
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/connections/social",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify(payload),
			}),
		);
		expect(invalidate).toHaveBeenCalled();
	});

	it("propagates error when API returns non-ok", async () => {
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "bad" }), { status: 400 }));
		const { Wrapper } = wrapperFactory();
		const { result } = renderHook(() => useCreateSocialConnection(), { wrapper: Wrapper });
		await act(async () => {
			await expect(result.current.mutateAsync({ provider: "google", client_id: "id", enabled: true })).rejects.toThrow("bad");
		});
	});

	it("uses fallback error message when body.json() rejects", async () => {
		const resp = new Response("", { status: 400 });
		Object.defineProperty(resp, "json", { value: () => Promise.reject(new Error("parse")) });
		fetchMock.mockResolvedValue(resp);
		const { Wrapper } = wrapperFactory();
		const { result } = renderHook(() => useCreateSocialConnection(), { wrapper: Wrapper });
		await act(async () => {
			await expect(result.current.mutateAsync({ provider: "google", client_id: "id", enabled: true })).rejects.toThrow(/400/);
		});
	});
});

describe("useToggleSocialConnection (PATCH)", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("PATCHes to /api/connections/social/<provider> with { enabled }", async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ success: true, provider: "google", enabled: false, reloadStatus: "reloaded" }), { status: 200 }),
		);
		const { Wrapper } = wrapperFactory();
		const { result } = renderHook(() => useToggleSocialConnection(), { wrapper: Wrapper });
		await act(async () => {
			await result.current.mutateAsync({ provider: "google", enabled: false });
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/connections/social/google",
			expect.objectContaining({ method: "PATCH", body: JSON.stringify({ enabled: false }) }),
		);
	});

	it("url-encodes the provider slug", async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ success: true, provider: "weird/provider", enabled: true, reloadStatus: "reloaded" }), { status: 200 }),
		);
		const { Wrapper } = wrapperFactory();
		const { result } = renderHook(() => useToggleSocialConnection(), { wrapper: Wrapper });
		await act(async () => {
			await result.current.mutateAsync({ provider: "weird/provider", enabled: true });
		});
		const url = fetchMock.mock.calls[0][0] as string;
		expect(url).toBe("/api/connections/social/weird%2Fprovider");
	});

	it("throws with API error message on non-ok", async () => {
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "toggle fail" }), { status: 500 }));
		const { Wrapper } = wrapperFactory();
		const { result } = renderHook(() => useToggleSocialConnection(), { wrapper: Wrapper });
		await act(async () => {
			await expect(result.current.mutateAsync({ provider: "google", enabled: true })).rejects.toThrow("toggle fail");
		});
	});

	it("uses fallback error message when body.json() rejects", async () => {
		const resp = new Response("", { status: 500 });
		Object.defineProperty(resp, "json", { value: () => Promise.reject(new Error("parse")) });
		fetchMock.mockResolvedValue(resp);
		const { Wrapper } = wrapperFactory();
		const { result } = renderHook(() => useToggleSocialConnection(), { wrapper: Wrapper });
		await act(async () => {
			await expect(result.current.mutateAsync({ provider: "google", enabled: true })).rejects.toThrow(/500/);
		});
	});
});

describe("useDeleteSocialConnection (DELETE)", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("DELETEs the provider endpoint", async () => {
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, provider: "google", reloadStatus: "reloaded" }), { status: 200 }));
		const { Wrapper } = wrapperFactory();
		const { result } = renderHook(() => useDeleteSocialConnection(), { wrapper: Wrapper });
		await act(async () => {
			await result.current.mutateAsync("google");
		});
		expect(fetchMock).toHaveBeenCalledWith("/api/connections/social/google", expect.objectContaining({ method: "DELETE" }));
	});

	it("throws with API error message on non-ok", async () => {
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "nope" }), { status: 500 }));
		const { Wrapper } = wrapperFactory();
		const { result } = renderHook(() => useDeleteSocialConnection(), { wrapper: Wrapper });
		await act(async () => {
			await expect(result.current.mutateAsync("google")).rejects.toThrow("nope");
		});
	});

	it("uses fallback error message when body.json() rejects", async () => {
		const resp = new Response("", { status: 500 });
		Object.defineProperty(resp, "json", { value: () => Promise.reject(new Error("parse")) });
		fetchMock.mockResolvedValue(resp);
		const { Wrapper } = wrapperFactory();
		const { result } = renderHook(() => useDeleteSocialConnection(), { wrapper: Wrapper });
		await act(async () => {
			await expect(result.current.mutateAsync("google")).rejects.toThrow(/500/);
		});
	});
});
