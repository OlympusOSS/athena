/**
 * Unit tests for POST /api/encrypt
 *
 * Exercises:
 *   - Success path (encryptApiKey called, returns { encrypted })
 *   - Error path (invalid JSON body => 500)
 */

import { describe, expect, it, vi } from "vitest";
import { buildRequest } from "@/app/api/__tests__/helpers";
import { POST } from "../route";

const { mockEncryptApiKey } = vi.hoisted(() => ({
	mockEncryptApiKey: vi.fn(),
}));

vi.mock("@/lib/crypto", () => ({
	encryptApiKey: mockEncryptApiKey,
}));

describe("POST /api/encrypt", () => {
	it("encrypts provided value and returns 200 with { encrypted }", async () => {
		mockEncryptApiKey.mockReturnValue("encrypted:abc");
		const req = buildRequest("POST", "http://localhost:4001/api/encrypt", { body: { value: "plaintext" } });
		const res = await POST(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ encrypted: "encrypted:abc" });
		expect(mockEncryptApiKey).toHaveBeenCalledWith("plaintext");
	});

	it("returns 500 when request body is not JSON", async () => {
		const req = new Request("http://localhost:4001/api/encrypt", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "not-json",
		});
		const res = await POST(req as unknown as import("next/server").NextRequest);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Encryption failed");
	});

	it("returns 500 when encryptApiKey throws", async () => {
		mockEncryptApiKey.mockImplementation(() => {
			throw new Error("boom");
		});
		const req = buildRequest("POST", "http://localhost:4001/api/encrypt", { body: { value: "plaintext" } });
		const res = await POST(req);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Encryption failed");
	});
});
