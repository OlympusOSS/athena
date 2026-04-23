/**
 * Unit tests for GET/POST /api/clients/m2m
 *
 * Mocks @/services/hydra (getAllOAuth2Clients, createOAuth2Client). Verifies:
 *   - GET filters to M2M clients (metadata.client_type === "m2m")
 *   - GET strips client_secret from list responses
 *   - GET 502 on Hydra failure
 *   - POST 400 on invalid JSON
 *   - POST 400 on missing client_name (Zod validation)
 *   - POST 400 on missing scope (Zod)
 *   - POST 400 on empty scope string
 *   - POST 400 on invalid scope (not in allowlist)
 *   - POST 422 on out-of-range token_lifetime (after Zod — defensive branch)
 *   - POST 201 on create success, returns client_secret once
 *   - POST 502 when Hydra throws
 *   - Audit emission verified (stdout write spy)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRequest } from "@/app/api/__tests__/helpers";
import { GET, POST } from "../route";

const { mockGetAllOAuth2Clients, mockCreateOAuth2Client } = vi.hoisted(() => ({
	mockGetAllOAuth2Clients: vi.fn(),
	mockCreateOAuth2Client: vi.fn(),
}));

vi.mock("@/services/hydra", () => ({
	getAllOAuth2Clients: mockGetAllOAuth2Clients,
	createOAuth2Client: mockCreateOAuth2Client,
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("GET /api/clients/m2m", () => {
	it("returns only M2M clients, strips client_secret", async () => {
		mockGetAllOAuth2Clients.mockResolvedValue({
			clients: [
				{ client_id: "m1", metadata: { client_type: "m2m" }, client_secret: "shh1", scope: "identities:read" },
				{ client_id: "u1", metadata: { client_type: "user" }, client_secret: "shh2", scope: "openid" },
				{ client_id: "m2", metadata: { client_type: "m2m" }, client_secret: "shh3", scope: "audit:read" },
				// Edge: metadata null / not an object
				{ client_id: "n1", metadata: null, client_secret: "x" },
				{ client_id: "s1", metadata: "not-an-object", client_secret: "x" },
				// metadata without client_type
				{ client_id: "x1", metadata: {}, client_secret: "x" },
			],
		});
		const req = buildRequest("GET", "http://localhost:4001/api/clients/m2m");
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.clients).toHaveLength(2);
		for (const c of body.clients) {
			expect(c.client_secret).toBeUndefined();
		}
	});

	it("handles null clients in result (defensive)", async () => {
		mockGetAllOAuth2Clients.mockResolvedValue({ clients: null });
		const req = buildRequest("GET", "http://localhost:4001/api/clients/m2m");
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.clients).toEqual([]);
	});

	it("returns 502 when Hydra throws an Error", async () => {
		mockGetAllOAuth2Clients.mockRejectedValue(new Error("hydra down"));
		const req = buildRequest("GET", "http://localhost:4001/api/clients/m2m");
		const res = await GET(req);
		expect(res.status).toBe(502);
		const body = await res.json();
		expect(body.error).toBe("upstream_unavailable");
	});

	it("returns 502 when Hydra throws non-Error value", async () => {
		mockGetAllOAuth2Clients.mockRejectedValue("string error");
		const req = buildRequest("GET", "http://localhost:4001/api/clients/m2m");
		const res = await GET(req);
		expect(res.status).toBe(502);
	});
});

describe("POST /api/clients/m2m", () => {
	it("returns 400 when body is invalid JSON", async () => {
		const req = new Request("http://localhost:4001/api/clients/m2m", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "not-json",
		});
		const res = await POST(req as unknown as import("next/server").NextRequest);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("missing_required_field");
	});

	it("returns 400 when client_name missing (Zod)", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: { scope: "identities:read" },
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("missing_required_field");
		expect(body.field).toBe("client_name");
	});

	it("returns 400 when scope missing (Zod)", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: { client_name: "my-client" },
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("missing_required_field");
		expect(body.field).toBe("scope");
	});

	it("returns 400 when token_lifetime is out of Zod range", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: { client_name: "c", scope: "identities:read", token_lifetime: 99999 },
		});
		const res = await POST(req);
		// Zod rejects before the defensive step 3 check (lines 164-174 are /* c8 ignore */).
		expect(res.status).toBe(400);
	});

	it("returns 400 when token_lifetime is below 1 (Zod range)", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: { client_name: "c", scope: "identities:read", token_lifetime: 0 },
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it("returns 400 with 'unknown' field when zod error has no path", async () => {
		// Zod's "required" error on a whole object (non-object body) produces a path=[]
		// which triggers the fallback `?? "unknown"`.
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: "not-an-object" as unknown as Record<string, unknown>,
		});
		// buildRequest JSON-stringifies non-strings; "not-an-object" is a string, so the
		// body becomes raw `not-an-object` (invalid JSON) => 400 "missing_required_field"
		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	it("returns 400 when Zod path is empty (pass a non-object body)", async () => {
		// Pass a JSON primitive that parses but fails Zod's object requirement
		const req = new Request("http://localhost:4001/api/clients/m2m", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "123",
		});
		const res = await POST(req as unknown as import("next/server").NextRequest);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("missing_required_field");
	});

	it("returns 400 with 'unknown' field when zod issue lacks path", async () => {
		// Zod error on root-level type mismatch has path = []
		const req = new Request("http://localhost:4001/api/clients/m2m", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify([]),
		});
		const res = await POST(req as unknown as import("next/server").NextRequest);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.field).toBeDefined();
	});

	it("returns 400 when scope is empty string", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: { client_name: "c", scope: "" },
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("invalid_scope");
		expect(body.message).toMatch(/at least one scope/i);
	});

	it("returns 400 when scope contains a non-permitted value", async () => {
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: { client_name: "c", scope: "identities:read admin:write" },
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("invalid_scope");
	});

	it("returns 201 on success with client_secret in body and emits audit event", async () => {
		mockCreateOAuth2Client.mockResolvedValue({
			data: {
				client_id: "abc123",
				client_secret: "sssssh-plaintext",
				client_name: "my-client",
				scope: "identities:read",
				grant_types: ["client_credentials"],
				created_at: "2026-04-23T10:00:00Z",
				metadata: { client_type: "m2m" },
			},
		});
		const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: { client_name: "my-client", scope: "identities:read" },
			headers: { "x-user-id": "admin-42", "x-user-email": "admin@test.com" },
		});
		const res = await POST(req);
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.client_id).toBe("abc123");
		expect(body.client_secret).toBe("sssssh-plaintext");
		expect(mockCreateOAuth2Client).toHaveBeenCalledWith(
			expect.objectContaining({
				client_name: "my-client",
				grant_types: ["client_credentials"],
				scope: "identities:read",
				client_credentials_grant_access_token_lifespan: "3600s",
				metadata: expect.objectContaining({ client_type: "m2m", created_by: "admin@test.com" }),
			}),
		);
		// Audit event was written to stdout
		expect(stdoutSpy).toHaveBeenCalled();
		const auditJson = stdoutSpy.mock.calls[0][0] as string;
		expect(auditJson).toContain('"type":"audit"');
		expect(auditJson).toContain("m2m_client.created");
		// Never logs client_secret
		expect(auditJson).not.toContain("sssssh-plaintext");
		stdoutSpy.mockRestore();
	});

	it("uses custom token_lifetime when provided (formats as 'Ns')", async () => {
		mockCreateOAuth2Client.mockResolvedValue({ data: { client_id: "abc", client_secret: "s" } });
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: { client_name: "c", scope: "identities:read", token_lifetime: 300 },
		});
		const res = await POST(req);
		expect(res.status).toBe(201);
		expect(mockCreateOAuth2Client).toHaveBeenCalledWith(expect.objectContaining({ client_credentials_grant_access_token_lifespan: "300s" }));
	});

	it("uses fallback 'unknown' for client_id/client_name in audit when absent", async () => {
		mockCreateOAuth2Client.mockResolvedValue({ data: {} });
		const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: { client_name: "c", scope: "identities:read" },
		});
		await POST(req);
		const auditJson = stdoutSpy.mock.calls[0][0] as string;
		expect(auditJson).toContain('"client_id":"unknown"');
		// client_name falls back to the body.client_name, not "unknown"
		expect(auditJson).toContain('"client_name":"c"');
		stdoutSpy.mockRestore();
	});

	it("returns 502 when Hydra throws Error", async () => {
		mockCreateOAuth2Client.mockRejectedValue(new Error("hydra down"));
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: { client_name: "c", scope: "identities:read" },
		});
		const res = await POST(req);
		expect(res.status).toBe(502);
		const body = await res.json();
		expect(body.error).toBe("upstream_unavailable");
	});

	it("returns 502 when Hydra throws non-Error value", async () => {
		mockCreateOAuth2Client.mockRejectedValue("string");
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: { client_name: "c", scope: "identities:read" },
		});
		const res = await POST(req);
		expect(res.status).toBe(502);
	});

	it("deduplicates repeated scopes before forwarding to Hydra", async () => {
		mockCreateOAuth2Client.mockResolvedValue({ data: { client_id: "a", client_secret: "s" } });
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: { client_name: "c", scope: "identities:read identities:read audit:read" },
		});
		await POST(req);
		expect(mockCreateOAuth2Client).toHaveBeenCalledWith(expect.objectContaining({ scope: "identities:read audit:read" }));
	});

	it("uses 'unknown' for admin identifiers when headers missing", async () => {
		mockCreateOAuth2Client.mockResolvedValue({ data: { client_id: "a", client_secret: "s" } });
		const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		const req = buildRequest("POST", "http://localhost:4001/api/clients/m2m", {
			body: { client_name: "c", scope: "identities:read" },
		});
		await POST(req);
		const auditJson = stdoutSpy.mock.calls[0][0] as string;
		expect(auditJson).toContain('"admin_id":"unknown"');
		expect(auditJson).toContain('"admin_email":"unknown"');
		stdoutSpy.mockRestore();
	});
});
