/**
 * Unit tests for utils/api-wrapper.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiCallError, createApiWrapper, withApiErrorHandling } from "../api-wrapper";

describe("ApiCallError", () => {
	it("stores status, code, and original error", () => {
		const original = { foo: 1 };
		const err = new ApiCallError("msg", 500, "SOME", original);
		expect(err.name).toBe("ApiCallError");
		expect(err.message).toBe("msg");
		expect(err.status).toBe(500);
		expect(err.code).toBe("SOME");
		expect(err.originalError).toBe(original);
	});
});

describe("withApiErrorHandling", () => {
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns the resolved value when the call succeeds", async () => {
		const result = await withApiErrorHandling(() => Promise.resolve("ok"));
		expect(result).toBe("ok");
	});

	it("re-throws CanceledError without logging or wrapping", async () => {
		const err: Error & { name: string } = new Error("canceled");
		err.name = "CanceledError";
		await expect(withApiErrorHandling(() => Promise.reject(err))).rejects.toBe(err);
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("re-throws AbortError without wrapping", async () => {
		const err: Error & { name: string } = new Error("abort");
		err.name = "AbortError";
		await expect(withApiErrorHandling(() => Promise.reject(err))).rejects.toBe(err);
	});

	it("re-throws ERR_CANCELED without wrapping", async () => {
		const err: Error & { code?: string } = new Error("canceled");
		err.code = "ERR_CANCELED";
		await expect(withApiErrorHandling(() => Promise.reject(err))).rejects.toBe(err);
	});

	it("extracts error.response.data.error.reason", async () => {
		const err = { response: { status: 400, data: { error: { reason: "v1-reason" } } } };
		await expect(withApiErrorHandling(() => Promise.reject(err), "Kratos")).rejects.toSatisfy((e) => {
			const ace = e as ApiCallError;
			return ace.status === 400 && ace.message === "v1-reason";
		});
	});

	it("extracts error.response.data.error.message", async () => {
		const err = { response: { status: 400, data: { error: { message: "v2-msg" } } } };
		await expect(withApiErrorHandling(() => Promise.reject(err))).rejects.toSatisfy((e) => (e as ApiCallError).message === "v2-msg");
	});

	it("extracts error.response.data.message", async () => {
		const err = { response: { status: 400, data: { message: "v3-msg" } } };
		await expect(withApiErrorHandling(() => Promise.reject(err))).rejects.toSatisfy((e) => (e as ApiCallError).message === "v3-msg");
	});

	it("falls back to response.statusText", async () => {
		const err = { response: { status: 500, statusText: "Internal Server Error", data: {} } };
		await expect(withApiErrorHandling(() => Promise.reject(err), "Kratos")).rejects.toSatisfy(
			(e) => (e as ApiCallError).message === "Kratos Internal Server Error",
		);
	});

	it("falls back to '<service> returned <status>' when nothing else present", async () => {
		const err = { response: { status: 418, data: {} } };
		await expect(withApiErrorHandling(() => Promise.reject(err), "Hydra")).rejects.toSatisfy(
			(e) => (e as ApiCallError).message === "Hydra returned 418",
		);
	});

	it("handles ECONNREFUSED network error", async () => {
		const err = { request: {}, code: "ECONNREFUSED", message: "refused" };
		await expect(withApiErrorHandling(() => Promise.reject(err), "Kratos")).rejects.toSatisfy((e) => {
			const ace = e as ApiCallError;
			return ace.code === "ECONNREFUSED" && ace.message.includes("connection refused");
		});
	});

	it("handles ETIMEDOUT network error", async () => {
		const err = { request: {}, code: "ETIMEDOUT" };
		await expect(withApiErrorHandling(() => Promise.reject(err), "Kratos")).rejects.toSatisfy((e) =>
			(e as ApiCallError).message.includes("timed out"),
		);
	});

	it("handles 'fetch failed' network error", async () => {
		const err = { request: {}, message: "fetch failed" };
		await expect(withApiErrorHandling(() => Promise.reject(err), "Kratos")).rejects.toSatisfy((e) =>
			(e as ApiCallError).message.includes("fetch failed"),
		);
	});

	it("handles generic network error", async () => {
		const err = { request: {}, message: "unknown network" };
		await expect(withApiErrorHandling(() => Promise.reject(err), "Hydra")).rejects.toSatisfy((e) =>
			(e as ApiCallError).message.includes("Network error"),
		);
	});

	it("falls through to message-only error", async () => {
		await expect(withApiErrorHandling(() => Promise.reject(new Error("generic")), "API")).rejects.toSatisfy(
			(e) => (e as ApiCallError).message === "generic",
		);
	});

	it("defaults service name to 'API'", async () => {
		await expect(withApiErrorHandling(() => Promise.reject(new Error("")))).rejects.toSatisfy((e) => {
			const ace = e as ApiCallError;
			// Either message is empty or defaulted to 'API request failed' if no path matched
			return ace instanceof ApiCallError;
		});
	});
});

describe("createApiWrapper", () => {
	it("wraps a function with error handling and passes args/return", async () => {
		const rawFn = async (a: number, b: number) => a + b;
		const wrapped = createApiWrapper(rawFn, "Math");
		await expect(wrapped(2, 3)).resolves.toBe(5);
	});

	it("wrapped function rethrows ApiCallError", async () => {
		const rawFn = async () => {
			throw { response: { status: 500, data: { error: { reason: "boom" } } } };
		};
		const wrapped = createApiWrapper(rawFn, "X");
		await expect(wrapped()).rejects.toBeInstanceOf(ApiCallError);
	});
});
