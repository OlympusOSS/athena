/**
 * Unit tests for DELETE /api/clients/m2m/[id]
 *
 * Mocks @/services/hydra.deleteOAuth2Client.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRequest } from "@/app/api/__tests__/helpers";
import { DELETE } from "../route";

const { mockDeleteOAuth2Client } = vi.hoisted(() => ({
	mockDeleteOAuth2Client: vi.fn(),
}));

vi.mock("@/services/hydra", () => ({
	deleteOAuth2Client: mockDeleteOAuth2Client,
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("DELETE /api/clients/m2m/[id]", () => {
	it("returns 400 when id param is empty string", async () => {
		const req = buildRequest("DELETE", "http://localhost:4001/api/clients/m2m/");
		const res = await DELETE(req, { params: Promise.resolve({ id: "" }) });
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("missing_required_field");
		expect(body.field).toBe("id");
	});

	it("returns 204 on successful delete and emits audit event", async () => {
		mockDeleteOAuth2Client.mockResolvedValue({ data: undefined });
		const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		const req = buildRequest("DELETE", "http://localhost:4001/api/clients/m2m/client-123", {
			headers: { "x-user-id": "admin-1", "x-user-email": "admin@test.com" },
		});
		const res = await DELETE(req, { params: Promise.resolve({ id: "client-123" }) });
		expect(res.status).toBe(204);
		expect(mockDeleteOAuth2Client).toHaveBeenCalledWith("client-123");
		const auditJson = stdoutSpy.mock.calls[0][0] as string;
		expect(auditJson).toContain('"type":"audit"');
		expect(auditJson).toContain("m2m_client.deleted");
		expect(auditJson).toContain('"client_id":"client-123"');
		expect(auditJson).toContain('"admin_id":"admin-1"');
		stdoutSpy.mockRestore();
	});

	it("falls back to 'unknown' admin id/email when headers missing", async () => {
		mockDeleteOAuth2Client.mockResolvedValue({ data: undefined });
		const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		const req = buildRequest("DELETE", "http://localhost:4001/api/clients/m2m/abc");
		await DELETE(req, { params: Promise.resolve({ id: "abc" }) });
		const auditJson = stdoutSpy.mock.calls[0][0] as string;
		expect(auditJson).toContain('"admin_id":"unknown"');
		expect(auditJson).toContain('"admin_email":"unknown"');
		stdoutSpy.mockRestore();
	});

	it("returns 502 when Hydra throws Error", async () => {
		mockDeleteOAuth2Client.mockRejectedValue(new Error("hydra down"));
		const req = buildRequest("DELETE", "http://localhost:4001/api/clients/m2m/abc");
		const res = await DELETE(req, { params: Promise.resolve({ id: "abc" }) });
		expect(res.status).toBe(502);
		const body = await res.json();
		expect(body.error).toBe("upstream_unavailable");
	});

	it("returns 502 when Hydra throws non-Error", async () => {
		mockDeleteOAuth2Client.mockRejectedValue("string");
		const req = buildRequest("DELETE", "http://localhost:4001/api/clients/m2m/abc");
		const res = await DELETE(req, { params: Promise.resolve({ id: "abc" }) });
		expect(res.status).toBe(502);
	});
});
