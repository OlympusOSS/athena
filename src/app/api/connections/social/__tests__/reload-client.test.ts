/**
 * Unit tests for src/lib/social-connections/reload-client.ts (T20 — athena#49)
 *
 * Covers all sidecar response states:
 * - HTTP 200 → "reloaded"
 * - HTTP 401 → "auth_failed"
 * - HTTP 500 → "failed"
 * - Connection refused / timeout → "unreachable"
 * - CIAM_RELOAD_SIDECAR_URL unset → "misconfigured"
 * - secretChanged=true → "skipped" (no sidecar call made)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoist mock factories before module imports
const { mockReloadKratosConfig, MockConfigurationError } = vi.hoisted(() => {
	// Minimal ConfigurationError stand-in — must match what reload-client catches
	class MockConfigurationError extends Error {
		constructor(message: string) {
			super(message);
			this.name = "ConfigurationError";
		}
	}
	return {
		mockReloadKratosConfig: vi.fn(),
		MockConfigurationError,
	};
});

vi.mock("@/services/kratos", () => ({
	reloadKratosConfig: mockReloadKratosConfig,
	ConfigurationError: MockConfigurationError,
}));

// axios mock — reload-client uses axios.isAxiosError to classify network errors
vi.mock("axios", async (importOriginal) => {
	const actual = await importOriginal<typeof import("axios")>();
	return {
		...actual,
		default: {
			...actual.default,
			isAxiosError: vi.fn((err: unknown): err is import("axios").AxiosError => {
				return (err as { isAxiosError?: boolean })?.isAxiosError === true;
			}),
		},
		isAxiosError: vi.fn((err: unknown): err is import("axios").AxiosError => {
			return (err as { isAxiosError?: boolean })?.isAxiosError === true;
		}),
	};
});

import { triggerReload } from "@/lib/social-connections/reload-client";

/** Helper that creates a minimal AxiosError-like object */
function makeAxiosError(status?: number): unknown {
	return {
		isAxiosError: true,
		response: status ? { status, data: {} } : undefined,
		message: status ? `Request failed with status ${status}` : "Network Error",
	};
}

describe("triggerReload", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// --- secretChanged=true path (no sidecar call) ---

	it("returns 'skipped' when secretChanged=true without calling sidecar (T20/Security)", async () => {
		const result = await triggerReload(true);
		expect(result.status).toBe("skipped");
		expect(mockReloadKratosConfig).not.toHaveBeenCalled();
	});

	// --- Successful reload ---

	it("returns 'reloaded' when sidecar responds with HTTP 200", async () => {
		mockReloadKratosConfig.mockResolvedValueOnce(undefined);
		const result = await triggerReload(false);
		expect(result.status).toBe("reloaded");
	});

	// --- ConfigurationError (CIAM_RELOAD_SIDECAR_URL unset) ---

	it("returns 'misconfigured' when CIAM_RELOAD_SIDECAR_URL is not set", async () => {
		mockReloadKratosConfig.mockRejectedValueOnce(new MockConfigurationError("CIAM_RELOAD_SIDECAR_URL is not set"));
		const result = await triggerReload(false);
		expect(result.status).toBe("misconfigured");
	});

	// --- Axios HTTP 401 ---

	it("returns 'auth_failed' when sidecar responds with HTTP 401 (key mismatch)", async () => {
		mockReloadKratosConfig.mockRejectedValueOnce(makeAxiosError(401));
		const result = await triggerReload(false);
		expect(result.status).toBe("auth_failed");
	});

	// --- Axios HTTP 500+ ---

	it("returns 'failed' when sidecar responds with HTTP 500", async () => {
		mockReloadKratosConfig.mockRejectedValueOnce(makeAxiosError(500));
		const result = await triggerReload(false);
		expect(result.status).toBe("failed");
	});

	it("returns 'failed' when sidecar responds with HTTP 503", async () => {
		mockReloadKratosConfig.mockRejectedValueOnce(makeAxiosError(503));
		const result = await triggerReload(false);
		expect(result.status).toBe("failed");
	});

	// --- Network error (connection refused, timeout) ---

	it("returns 'unreachable' when sidecar is unreachable (no response)", async () => {
		// No response property → axios.isAxiosError but response is undefined
		mockReloadKratosConfig.mockRejectedValueOnce(makeAxiosError(undefined));
		const result = await triggerReload(false);
		expect(result.status).toBe("unreachable");
	});

	// --- Unexpected error (non-axios) ---

	it("returns 'unreachable' for unexpected non-axios errors without throwing", async () => {
		mockReloadKratosConfig.mockRejectedValueOnce(new TypeError("Unexpected internal error"));
		const result = await triggerReload(false);
		// Must not throw — all errors produce a typed status
		expect(result.status).toBe("unreachable");
	});

	it("returns 'unreachable' for non-Error rejections (e.g., string or object)", async () => {
		// Exercises the `error instanceof Error ? error.message : String(error)` false branch.
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		mockReloadKratosConfig.mockRejectedValueOnce("bare-string-error");
		const result = await triggerReload(false);
		expect(result.status).toBe("unreachable");
		expect(errSpy).toHaveBeenCalledWith("[reload-client] Unexpected error during reload trigger:", { message: "bare-string-error" });
		errSpy.mockRestore();
	});
});
