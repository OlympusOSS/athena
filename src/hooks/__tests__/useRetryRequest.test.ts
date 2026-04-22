/**
 * Unit tests for hooks/useRetryRequest.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError, NetworkError, TimeoutError } from "@/lib/http-client";
import { getErrorMessage, isRetryableError, useKratosRequest, useRetryRequest } from "../useRetryRequest";

describe("useRetryRequest", () => {
	it("initial state is empty", () => {
		const requestFn = vi.fn().mockResolvedValue("ok");
		const { result } = renderHook(() => useRetryRequest(requestFn));
		expect(result.current.data).toBeNull();
		expect(result.current.loading).toBe(false);
		expect(result.current.error).toBeNull();
	});

	it("execute() sets data on success", async () => {
		const requestFn = vi.fn().mockResolvedValue("payload");
		const { result } = renderHook(() => useRetryRequest(requestFn));
		let returnValue: unknown;
		await act(async () => {
			returnValue = await result.current.execute();
		});
		expect(returnValue).toBe("payload");
		expect(result.current.data).toBe("payload");
		expect(result.current.loading).toBe(false);
		expect(result.current.error).toBeNull();
	});

	it("execute() sets error when request rejects", async () => {
		const err = new Error("fail");
		const requestFn = vi.fn().mockRejectedValue(err);
		const onError = vi.fn();
		const { result } = renderHook(() => useRetryRequest(requestFn, { onError }));
		await act(async () => {
			await expect(result.current.execute()).rejects.toThrow("fail");
		});
		expect(result.current.error).toBe(err);
		expect(result.current.loading).toBe(false);
		expect(onError).toHaveBeenCalledWith(err);
	});

	it("retry() re-executes", async () => {
		const requestFn = vi.fn().mockResolvedValue("again");
		const { result } = renderHook(() => useRetryRequest(requestFn));
		await act(async () => {
			await result.current.retry();
		});
		expect(result.current.data).toBe("again");
		expect(requestFn).toHaveBeenCalled();
	});

	it("reset() clears data/error/loading", async () => {
		const requestFn = vi.fn().mockResolvedValue("v");
		const { result } = renderHook(() => useRetryRequest(requestFn));
		await act(async () => {
			await result.current.execute();
		});
		expect(result.current.data).toBe("v");
		act(() => result.current.reset());
		expect(result.current.data).toBeNull();
		expect(result.current.error).toBeNull();
		expect(result.current.loading).toBe(false);
	});
});

describe("useKratosRequest", () => {
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("wraps useRetryRequest with enhanced HTTP error logging", async () => {
		const err = new HttpError("nope", 500, "ISE", "http://x");
		const requestFn = vi.fn().mockRejectedValue(err);
		const { result } = renderHook(() => useKratosRequest(requestFn));
		await act(async () => {
			await expect(result.current.execute()).rejects.toBe(err);
		});
		expect(errorSpy).toHaveBeenCalledWith(
			"[Kratos Request] HTTP Error:",
			expect.objectContaining({ status: 500, url: "http://x" }),
		);
	});

	it("logs NetworkError", async () => {
		const err = new NetworkError("gone", "ENOTFOUND", "http://x");
		const requestFn = vi.fn().mockRejectedValue(err);
		const { result } = renderHook(() => useKratosRequest(requestFn));
		await act(async () => {
			await expect(result.current.execute()).rejects.toBe(err);
		});
		expect(errorSpy).toHaveBeenCalledWith("[Kratos Request] Network Error:", "gone");
	});

	it("logs TimeoutError", async () => {
		const err = new TimeoutError(1000, "http://x");
		const requestFn = vi.fn().mockRejectedValue(err);
		const { result } = renderHook(() => useKratosRequest(requestFn));
		await act(async () => {
			await expect(result.current.execute()).rejects.toBe(err);
		});
		expect(errorSpy).toHaveBeenCalledWith("[Kratos Request] Timeout Error:", expect.any(String));
	});

	it("logs generic unknown error", async () => {
		const err = new Error("other");
		const requestFn = vi.fn().mockRejectedValue(err);
		const { result } = renderHook(() => useKratosRequest(requestFn));
		await act(async () => {
			await expect(result.current.execute()).rejects.toBe(err);
		});
		expect(errorSpy).toHaveBeenCalledWith("[Kratos Request] Unknown Error:", err);
	});

	it("forwards user onError and onRetry options", async () => {
		const err = new Error("x");
		const requestFn = vi.fn().mockRejectedValue(err);
		const onError = vi.fn();
		const onRetry = vi.fn();
		const { result } = renderHook(() => useKratosRequest(requestFn, { onError, onRetry }));
		await act(async () => {
			await expect(result.current.execute()).rejects.toBe(err);
		});
		expect(onError).toHaveBeenCalledWith(err);
	});
});

describe("isRetryableError", () => {
	it("true for NetworkError", () => {
		expect(isRetryableError(new NetworkError("x"))).toBe(true);
	});

	it("true for TimeoutError", () => {
		expect(isRetryableError(new TimeoutError(1000, "http://x"))).toBe(true);
	});

	it("true for HttpError 5xx", () => {
		expect(isRetryableError(new HttpError("", 500))).toBe(true);
		expect(isRetryableError(new HttpError("", 502))).toBe(true);
	});

	it("true for HttpError 429", () => {
		expect(isRetryableError(new HttpError("", 429))).toBe(true);
	});

	it("false for HttpError 4xx (other)", () => {
		expect(isRetryableError(new HttpError("", 404))).toBe(false);
		expect(isRetryableError(new HttpError("", 403))).toBe(false);
	});

	it("false for generic Error", () => {
		expect(isRetryableError(new Error("other"))).toBe(false);
	});
});

describe("getErrorMessage", () => {
	it("HttpError 404 → 'Resource not found'", () => {
		expect(getErrorMessage(new HttpError("raw", 404))).toBe("Resource not found");
	});

	it("HttpError 401 → 'Authentication required'", () => {
		expect(getErrorMessage(new HttpError("raw", 401))).toBe("Authentication required");
	});

	it("HttpError 403 → 'Access denied'", () => {
		expect(getErrorMessage(new HttpError("raw", 403))).toBe("Access denied");
	});

	it("HttpError 429 → rate limit message", () => {
		expect(getErrorMessage(new HttpError("raw", 429))).toMatch(/too many/i);
	});

	it("HttpError 500+ → 'Server error, please try again'", () => {
		expect(getErrorMessage(new HttpError("raw", 500))).toMatch(/server error/i);
	});

	it("HttpError with unknown status uses raw message", () => {
		expect(getErrorMessage(new HttpError("custom-message", 418))).toBe("custom-message");
	});

	it("NetworkError → user-friendly connection message", () => {
		expect(getErrorMessage(new NetworkError("raw"))).toMatch(/network connection/i);
	});

	it("TimeoutError → user-friendly timeout message", () => {
		expect(getErrorMessage(new TimeoutError(1000, "http://x"))).toMatch(/timed out/i);
	});

	it("Plain Error with message", () => {
		expect(getErrorMessage(new Error("oops"))).toBe("oops");
	});

	it("Plain Error without message falls back to generic", () => {
		expect(getErrorMessage(new Error(""))).toBe("An unexpected error occurred");
	});
});
