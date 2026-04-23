/**
 * Unit tests for POST /api/clients/m2m/[id]/rotate-secret
 *
 * Mocks @/services/hydra.rotateOAuth2ClientSecret.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRequest } from "@/app/api/__tests__/helpers";
import { POST } from "../route";

const { mockRotateOAuth2ClientSecret } = vi.hoisted(() => ({
	mockRotateOAuth2ClientSecret: vi.fn(),
}));

vi.mock("@/services/hydra", () => ({
	rotateOAuth2ClientSecret: mockRotateOAuth2ClientSecret,
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("POST /api/clients/m2m/[id]/rotate-secret", () => {
	it("returns 400 when id is empty", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m//rotate-secret");
		const res = await POST(req, { params: Promise.resolve({ id: "" }) });
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("missing_required_field");
		expect(body.field).toBe("id");
	});

	it("returns 200 with new client_secret and emits audit event", async () => {
		mockRotateOAuth2ClientSecret.mockResolvedValue({ client_id: "abc", client_secret: "new-secret" });
		const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m/abc/rotate-secret", {
			headers: { "x-user-id": "admin-1", "x-user-email": "admin@test.com" },
		});
		const res = await POST(req, { params: Promise.resolve({ id: "abc" }) });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.client_id).toBe("abc");
		expect(body.client_secret).toBe("new-secret");

		// Secret generated server-side is 32 bytes = 64 hex chars
		const newSecretArg = mockRotateOAuth2ClientSecret.mock.calls[0][1] as string;
		expect(newSecretArg).toHaveLength(64);
		expect(newSecretArg).toMatch(/^[0-9a-f]{64}$/);

		const auditJson = stdoutSpy.mock.calls[0][0] as string;
		expect(auditJson).toContain("m2m_client.secret_rotated");
		expect(auditJson).toContain('"type":"audit"');
		// Secret must never appear in audit
		expect(auditJson).not.toContain("new-secret");
		expect(auditJson).not.toContain(newSecretArg);
		stdoutSpy.mockRestore();
	});

	it("falls back to 'unknown' admin id/email when headers missing", async () => {
		mockRotateOAuth2ClientSecret.mockResolvedValue({ client_id: "abc", client_secret: "s" });
		const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m/abc/rotate-secret");
		await POST(req, { params: Promise.resolve({ id: "abc" }) });
		const auditJson = stdoutSpy.mock.calls[0][0] as string;
		expect(auditJson).toContain('"admin_id":"unknown"');
		expect(auditJson).toContain('"admin_email":"unknown"');
		stdoutSpy.mockRestore();
	});

	it("returns 502 when Hydra throws Error", async () => {
		mockRotateOAuth2ClientSecret.mockRejectedValue(new Error("hydra down"));
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m/abc/rotate-secret");
		const res = await POST(req, { params: Promise.resolve({ id: "abc" }) });
		expect(res.status).toBe(502);
		const body = await res.json();
		expect(body.error).toBe("upstream_unavailable");
	});

	it("returns 502 when Hydra throws non-Error value", async () => {
		mockRotateOAuth2ClientSecret.mockRejectedValue("string");
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m/abc/rotate-secret");
		const res = await POST(req, { params: Promise.resolve({ id: "abc" }) });
		expect(res.status).toBe(502);
	});
});
