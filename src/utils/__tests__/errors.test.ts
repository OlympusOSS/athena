/**
 * Unit tests for utils/errors.ts (parseError, isConnectionError, shouldSuggestSettings).
 */

import { describe, expect, it } from "vitest";
import { isConnectionError, parseError, shouldSuggestSettings } from "../errors";

describe("parseError", () => {
	it("connection error — 'fetch failed'", () => {
		const r = parseError(new Error("fetch failed"));
		expect(r.type).toBe("connection");
		expect(r.canRetry).toBe(true);
		expect(r.suggestSettings).toBe(true);
	});

	it("connection error — ECONNREFUSED", () => {
		const r = parseError(new Error("Error: ECONNREFUSED 127.0.0.1"));
		expect(r.type).toBe("connection");
	});

	it("connection error — 'Failed to fetch'", () => {
		const r = parseError(new Error("Failed to fetch"));
		expect(r.type).toBe("connection");
	});

	it("connection error — 'network request failed'", () => {
		const r = parseError(new Error("network request failed"));
		expect(r.type).toBe("connection");
	});

	it("connection error — 'network error'", () => {
		const r = parseError(new Error("network error"));
		expect(r.type).toBe("connection");
	});

	it("connection error — 'connection refused'", () => {
		const r = parseError(new Error("Connection refused"));
		expect(r.type).toBe("connection");
	});

	it("timeout error", () => {
		const r = parseError(new Error("request timed out"));
		expect(r.type).toBe("network");
		expect(r.title).toBe("Request Timeout");
	});

	it("timeout error — 'timeout'", () => {
		const r = parseError(new Error("Timeout after 30s"));
		expect(r.type).toBe("network");
	});

	it("CORS error", () => {
		const r = parseError(new Error("CORS blocked"));
		expect(r.title).toBe("CORS Error");
		expect(r.canRetry).toBe(false);
	});

	it("cross-origin error", () => {
		const r = parseError(new Error("cross-origin read blocked"));
		expect(r.title).toBe("CORS Error");
	});

	it("invalid url error", () => {
		const r = parseError(new Error("invalid url"));
		expect(r.title).toBe("Invalid Configuration");
		expect(r.canRetry).toBe(false);
	});

	it("malformed url error", () => {
		const r = parseError(new Error("malformed URL"));
		expect(r.title).toBe("Invalid Configuration");
	});

	it("404 error", () => {
		const r = parseError(new Error("404 not found"));
		expect(r.title).toBe("Endpoint Not Found");
		expect(r.type).toBe("api");
	});

	it("401 error", () => {
		const r = parseError(new Error("401 unauthorized"));
		expect(r.title).toBe("Authentication Error");
	});

	it("403 error", () => {
		const r = parseError(new Error("403 forbidden"));
		expect(r.title).toBe("Authentication Error");
	});

	it("500 error", () => {
		const r = parseError(new Error("500 internal server"));
		expect(r.title).toBe("Server Error");
		expect(r.canRetry).toBe(true);
	});

	it("generic Error with message", () => {
		const r = parseError(new Error("something else"));
		expect(r.title).toBe("Error");
		expect(r.message).toBe("something else");
		expect(r.type).toBe("unknown");
	});

	it("Error without message uses fallback", () => {
		const r = parseError(new Error(""));
		expect(r.message).toBe("An unexpected error occurred.");
	});

	it("string error", () => {
		const r = parseError("just a string");
		expect(r.title).toBe("Error");
		expect(r.message).toBe("just a string");
	});

	it("object with message property", () => {
		const r = parseError({ message: "object message" });
		expect(r.message).toBe("object message");
	});

	it("fallback for unknown type (null, number, etc.)", () => {
		expect(parseError(null).title).toBe("Unknown Error");
		expect(parseError(undefined).title).toBe("Unknown Error");
		expect(parseError(42).title).toBe("Unknown Error");
	});
});

describe("isConnectionError", () => {
	it("true for connection errors", () => {
		expect(isConnectionError(new Error("fetch failed"))).toBe(true);
	});

	it("false for non-connection errors", () => {
		expect(isConnectionError(new Error("500 internal"))).toBe(false);
		expect(isConnectionError(null)).toBe(false);
	});
});

describe("shouldSuggestSettings", () => {
	it("true for connection errors", () => {
		expect(shouldSuggestSettings(new Error("fetch failed"))).toBe(true);
	});

	it("true for CORS errors", () => {
		expect(shouldSuggestSettings(new Error("CORS blocked"))).toBe(true);
	});

	it("false for timeout errors", () => {
		expect(shouldSuggestSettings(new Error("timed out"))).toBe(false);
	});

	it("false for generic errors", () => {
		expect(shouldSuggestSettings(new Error("something"))).toBe(false);
	});
});
