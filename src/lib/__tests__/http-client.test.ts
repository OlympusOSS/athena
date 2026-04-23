/**
 * Unit tests for lib/http-client.ts.
 *
 * Covers: HttpClient.fetch / get / post / put / patch / delete,
 * retry/backoff behavior, timeout, custom headers,
 * HttpError / NetworkError / TimeoutError exports.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpClient, HttpError, httpClient, kratosHttpClient, NetworkError, TimeoutError } from "../http-client";

describe("HttpClient success paths", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("GET returns the response when fetch resolves with ok=true", async () => {
		const ok = new Response("ok", { status: 200, statusText: "OK" });
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok));
		const client = new HttpClient();
		const res = await client.get("http://example.com");
		expect(res.ok).toBe(true);
	});

	it("GET merges default headers and per-call headers", async () => {
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const client = new HttpClient({ headers: { "X-Default": "D" } });
		await client.get("http://example.com", { headers: { "X-Extra": "E" } });
		const init = fetchMock.mock.calls[0][1];
		expect(init.headers["X-Default"]).toBe("D");
		expect(init.headers["X-Extra"]).toBe("E");
	});

	it("POST sends JSON-serialized body with Content-Type json", async () => {
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const client = new HttpClient();
		await client.post("http://example.com/x", { a: 1 });
		const init = fetchMock.mock.calls[0][1];
		expect(init.method).toBe("POST");
		expect(init.body).toBe(JSON.stringify({ a: 1 }));
		expect(init.headers["Content-Type"]).toBe("application/json");
	});

	it("POST accepts pre-stringified body", async () => {
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const client = new HttpClient();
		await client.post("http://example.com/x", "already-a-string");
		const init = fetchMock.mock.calls[0][1];
		expect(init.body).toBe("already-a-string");
	});

	it("PUT with pre-stringified body skips JSON.stringify", async () => {
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const client = new HttpClient();
		await client.put("http://example.com/x", "raw-string");
		expect(fetchMock.mock.calls[0][1].body).toBe("raw-string");
	});

	it("PATCH serializes object body + accepts pre-stringified body", async () => {
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const client = new HttpClient();
		await client.patch("http://example.com/x", { a: 1 });
		await client.patch("http://example.com/x", "patch-raw");
		expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ a: 1 }));
		expect(fetchMock.mock.calls[1][1].body).toBe("patch-raw");
	});

	it("POST/PUT/PATCH merge per-call headers with default Content-Type", async () => {
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const client = new HttpClient();
		await client.post("http://example.com", { a: 1 }, { headers: { "X-Extra": "E" } });
		await client.put("http://example.com", { a: 1 }, { headers: { "X-Extra": "E" } });
		await client.patch("http://example.com", { a: 1 }, { headers: { "X-Extra": "E" } });
		for (const call of fetchMock.mock.calls) {
			expect(call[1].headers["Content-Type"]).toBe("application/json");
			expect(call[1].headers["X-Extra"]).toBe("E");
		}
	});

	it("PUT, PATCH, DELETE each use the correct method", async () => {
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const client = new HttpClient({ maxRetries: 0 });
		await client.put("http://example.com", { a: 1 });
		await client.patch("http://example.com", { b: 2 });
		await client.delete("http://example.com");
		expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
		expect(fetchMock.mock.calls[1][1].method).toBe("PATCH");
		expect(fetchMock.mock.calls[2][1].method).toBe("DELETE");
	});
});

describe("HttpClient error paths", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("throws HttpError on 4xx (no retry for client errors)", async () => {
		const bad = new Response("bad", { status: 400, statusText: "Bad Request" });
		const fetchMock = vi.fn().mockResolvedValue(bad);
		vi.stubGlobal("fetch", fetchMock);
		const client = new HttpClient({ maxRetries: 3 });
		await expect(client.get("http://example.com")).rejects.toBeInstanceOf(HttpError);
		expect(fetchMock).toHaveBeenCalledTimes(1); // no retries for 4xx
	});

	it("retries on 5xx then eventually throws HttpError", async () => {
		const ise = new Response("ise", { status: 500, statusText: "Internal Server Error" });
		const fetchMock = vi.fn().mockResolvedValue(ise);
		vi.stubGlobal("fetch", fetchMock);
		const client = new HttpClient({ maxRetries: 2, baseDelay: 1, maxDelay: 1 });
		await expect(client.get("http://example.com")).rejects.toBeInstanceOf(HttpError);
		expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
	});

	it("throws NetworkError when fetch rejects with a network-like message", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch failed: ECONNRESET")));
		const client = new HttpClient({ maxRetries: 0 });
		await expect(client.get("http://example.com")).rejects.toBeInstanceOf(NetworkError);
	});

	it("NetworkError instance has code and url when set", async () => {
		const err: Error & { code?: string } = new Error("ENOTFOUND - dns");
		err.code = "ENOTFOUND";
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));
		const client = new HttpClient({ maxRetries: 0 });
		try {
			await client.get("http://example.com");
			throw new Error("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(NetworkError);
			expect((e as NetworkError).code).toBe("ENOTFOUND");
			expect((e as NetworkError).url).toBe("http://example.com");
		}
	});

	it("throws TimeoutError when fetch rejects with AbortError", async () => {
		const abort = new Error("aborted");
		abort.name = "AbortError";
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
		const client = new HttpClient({ maxRetries: 0, timeout: 1 });
		await expect(client.get("http://example.com")).rejects.toBeInstanceOf(TimeoutError);
	});

	it("fires onRetry callback between attempts", async () => {
		const ise = new Response("ise", { status: 500 });
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ise));
		const onRetry = vi.fn();
		const client = new HttpClient({ maxRetries: 2, baseDelay: 1, maxDelay: 1, onRetry });
		await expect(client.get("http://example.com")).rejects.toBeInstanceOf(HttpError);
		expect(onRetry).toHaveBeenCalledTimes(2);
	});

	it("re-throws non-categorizable Errors unchanged", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("random failure")));
		const client = new HttpClient({ maxRetries: 0 });
		// Not a network/timeout keyword — should re-throw Error as-is
		await expect(client.get("http://example.com")).rejects.toThrow("random failure");
	});

	it("caller-supplied signal overrides internal timeout signal", async () => {
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const ac = new AbortController();
		const client = new HttpClient();
		await client.fetch("http://example.com", { signal: ac.signal });
		expect(fetchMock.mock.calls[0][1].signal).toBe(ac.signal);
	});

	it("default retryCondition retries non-categorized Errors (fallback branch)", async () => {
		// A plain Error whose message doesn't match network-keyword patterns is re-thrown
		// as-is. With maxRetries > 0, retryCondition's fallback `return attempt < 3` runs.
		const err = new Error("completely-unknown-failure");
		const fetchMock = vi.fn().mockRejectedValue(err);
		vi.stubGlobal("fetch", fetchMock);
		const client = new HttpClient({ maxRetries: 2, baseDelay: 1, maxDelay: 1 });
		await expect(client.get("http://example.com")).rejects.toThrow("completely-unknown-failure");
		// Initial + 2 retries (fallback returns true for attempt 1 and 2)
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("default retryCondition retries on NetworkError (branch)", async () => {
		// Default retryCondition's `error instanceof NetworkError` branch: the first rejection
		// has a network-keyword message → wrapped as NetworkError → retryCondition returns true.
		const netErr = new Error("fetch failed: ECONNRESET");
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockRejectedValueOnce(netErr).mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const client = new HttpClient({ maxRetries: 3, baseDelay: 1, maxDelay: 1 });
		const res = await client.get("http://example.com");
		expect(res.ok).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("default retryCondition retries on TimeoutError (branch)", async () => {
		// Default retryCondition's `error instanceof TimeoutError` branch: AbortError → TimeoutError → retry.
		const abort = new Error("aborted");
		abort.name = "AbortError";
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockRejectedValueOnce(abort).mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const client = new HttpClient({ maxRetries: 3, baseDelay: 1, maxDelay: 1 });
		const res = await client.get("http://example.com");
		expect(res.ok).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

describe("HttpError / NetworkError / TimeoutError constructors", () => {
	it("HttpError stores status, statusText, and url", () => {
		const e = new HttpError("msg", 404, "Not Found", "http://x");
		expect(e.message).toBe("msg");
		expect(e.name).toBe("HttpError");
		expect(e.status).toBe(404);
		expect(e.statusText).toBe("Not Found");
		expect(e.url).toBe("http://x");
	});

	it("TimeoutError name and message", () => {
		const e = new TimeoutError(5000, "http://x");
		expect(e.name).toBe("TimeoutError");
		expect(e.message).toBe("Request timeout after 5000ms: http://x");
	});

	it("NetworkError stores code and url", () => {
		const e = new NetworkError("msg", "ECONNRESET", "http://x");
		expect(e.name).toBe("NetworkError");
		expect(e.code).toBe("ECONNRESET");
		expect(e.url).toBe("http://x");
	});
});

describe("Default httpClient + kratosHttpClient instances", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("default httpClient is defined and functional", async () => {
		const ok = new Response("ok", { status: 200 });
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok));
		const res = await httpClient.get("http://example.com");
		expect(res.ok).toBe(true);
	});

	it("kratosHttpClient retries on 429", async () => {
		const rateLimited = new Response("", { status: 429 });
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockResolvedValueOnce(rateLimited).mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const res = await kratosHttpClient.get("http://example.com");
		expect(res.ok).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("kratosHttpClient does NOT retry on 404", async () => {
		const notFound = new Response("", { status: 404, statusText: "Not Found" });
		const fetchMock = vi.fn().mockResolvedValue(notFound);
		vi.stubGlobal("fetch", fetchMock);
		await expect(kratosHttpClient.get("http://example.com")).rejects.toBeInstanceOf(HttpError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("kratosHttpClient retries NetworkError", async () => {
		const err = new Error("fetch failed: ECONNRESET");
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockRejectedValueOnce(err).mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const res = await kratosHttpClient.get("http://example.com");
		expect(res.ok).toBe(true);
	});

	it("kratosHttpClient retryCondition fallback returns true for non-categorized errors", async () => {
		// A plain Error that doesn't match any network/timeout/HttpError branch exercises
		// the final `return attempt <= 3` fallback in kratosHttpClient.retryCondition.
		const err = new Error("unexpected-shape-error");
		const fetchMock = vi.fn().mockRejectedValue(err);
		vi.stubGlobal("fetch", fetchMock);
		await expect(kratosHttpClient.get("http://example.com")).rejects.toThrow("unexpected-shape-error");
		// Initial + 3 retries per kratosHttpClient.maxRetries=3
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it("kratosHttpClient retries on TimeoutError", async () => {
		// AbortError is mapped to TimeoutError by HttpClient → retryCondition returns true.
		const abort = new Error("aborted");
		abort.name = "AbortError";
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockRejectedValueOnce(abort).mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const res = await kratosHttpClient.get("http://example.com");
		expect(res.ok).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("kratosHttpClient retries on HttpError 5xx", async () => {
		const ise = new Response("ise", { status: 500, statusText: "Internal Server Error" });
		const ok = new Response("ok", { status: 200 });
		const fetchMock = vi.fn().mockResolvedValueOnce(ise).mockResolvedValue(ok);
		vi.stubGlobal("fetch", fetchMock);
		const res = await kratosHttpClient.get("http://example.com");
		expect(res.ok).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});
