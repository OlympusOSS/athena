/**
 * Unit tests for GET and PUT /api/dashboard/layout
 *
 * Mocks @/lib/session.verifySession and global fetch (IAM Kratos admin).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRequest } from "@/app/api/__tests__/helpers";
import type { SessionData } from "@/lib/session";
import { signSession } from "@/lib/session";
import { GET, PUT } from "../route";

const originalEnv = { ...process.env };

beforeEach(() => {
	process.env = { ...originalEnv };
	process.env.ENCRYPTION_KEY = "test-encryption-key-for-vitest-32ch";
	process.env.IAM_KRATOS_ADMIN_URL = "http://kratos.internal";
	process.env.PROXY_TIMEOUT_MS = "5000";
	vi.clearAllMocks();
});

afterEach(() => {
	process.env = { ...originalEnv };
	vi.unstubAllGlobals();
});

const sessionData: SessionData = {
	accessToken: "at",
	idToken: "id.tok.sig",
	refreshToken: "rt",
	expiresIn: 3600,
	user: {
		kratosIdentityId: "user-1",
		email: "admin@example.com",
		role: "admin",
		displayName: "Admin",
	},
};

async function validCookie(): Promise<string> {
	return signSession(sessionData);
}

describe("GET /api/dashboard/layout", () => {
	it("returns 401 when no session cookie present", async () => {
		const req = buildRequest("GET", "http://localhost:4001/api/dashboard/layout");
		const res = await GET(req);
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBe("not_authenticated");
	});

	it("returns 401 when session cookie is invalid", async () => {
		const req = buildRequest("GET", "http://localhost:4001/api/dashboard/layout", {
			cookies: { "athena-session": "bad.cookie" },
		});
		const res = await GET(req);
		expect(res.status).toBe(401);
	});

	it("returns saved layout from identity.metadata_public.dashboardLayout", async () => {
		const cookie = await validCookie();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ metadata_public: { dashboardLayout: { rows: [{ id: "a" }] } } }),
			}),
		);
		const req = buildRequest("GET", "http://localhost:4001/api/dashboard/layout", {
			cookies: { "athena-session": cookie },
		});
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.layout).toEqual({ rows: [{ id: "a" }] });
	});

	it("returns null layout when metadata_public has no dashboardLayout key", async () => {
		const cookie = await validCookie();
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ metadata_public: {} }) }));
		const req = buildRequest("GET", "http://localhost:4001/api/dashboard/layout", {
			cookies: { "athena-session": cookie },
		});
		const res = await GET(req);
		const body = await res.json();
		expect(body.layout).toBeNull();
	});

	it("returns null layout when metadata_public is missing", async () => {
		const cookie = await validCookie();
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
		const req = buildRequest("GET", "http://localhost:4001/api/dashboard/layout", {
			cookies: { "athena-session": cookie },
		});
		const res = await GET(req);
		const body = await res.json();
		expect(body.layout).toBeNull();
	});

	it("returns 500 when Kratos identity fetch returns non-ok", async () => {
		const cookie = await validCookie();
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve("not found") }));
		const req = buildRequest("GET", "http://localhost:4001/api/dashboard/layout", {
			cookies: { "athena-session": cookie },
		});
		const res = await GET(req);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Failed to fetch identity");
	});

	it("returns 504 when fetch throws TimeoutError", async () => {
		const cookie = await validCookie();
		const timeoutError = new Error("Request timed out");
		timeoutError.name = "TimeoutError";
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutError));
		const req = buildRequest("GET", "http://localhost:4001/api/dashboard/layout", {
			cookies: { "athena-session": cookie },
		});
		const res = await GET(req);
		expect(res.status).toBe(504);
		const body = await res.json();
		expect(body.error).toBe("Gateway Timeout");
	});

	it("returns 500 on generic fetch error", async () => {
		const cookie = await validCookie();
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
		const req = buildRequest("GET", "http://localhost:4001/api/dashboard/layout", {
			cookies: { "athena-session": cookie },
		});
		const res = await GET(req);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Internal server error");
	});
});

describe("PUT /api/dashboard/layout", () => {
	it("returns 401 when no session cookie", async () => {
		const req = buildRequest("PUT", "http://localhost:4001/api/dashboard/layout", {
			body: { layout: { rows: [] } },
		});
		const res = await PUT(req);
		expect(res.status).toBe(401);
	});

	it("returns 400 when body.layout is missing", async () => {
		const cookie = await validCookie();
		const req = buildRequest("PUT", "http://localhost:4001/api/dashboard/layout", {
			body: {},
			cookies: { "athena-session": cookie },
		});
		const res = await PUT(req);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Missing layout in request body");
	});

	it("returns 500 when identity fetch fails", async () => {
		const cookie = await validCookie();
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
		const req = buildRequest("PUT", "http://localhost:4001/api/dashboard/layout", {
			body: { layout: { rows: [] } },
			cookies: { "athena-session": cookie },
		});
		const res = await PUT(req);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Failed to fetch identity");
	});

	it("merges new layout with existing metadata and returns success", async () => {
		const cookie = await validCookie();
		const existingIdentity = {
			schema_id: "default",
			traits: { email: "admin@example.com" },
			metadata_public: { theme: "dark", oldLayout: "keep-me" },
			metadata_admin: { note: "admin note" },
			state: "active",
		};
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(existingIdentity) })
			.mockResolvedValueOnce({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		const req = buildRequest("PUT", "http://localhost:4001/api/dashboard/layout", {
			body: { layout: { rows: [{ id: "new" }] } },
			cookies: { "athena-session": cookie },
		});
		const res = await PUT(req);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.success).toBe(true);
		// Verify the PUT payload merges old metadata + new layout
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const putCall = fetchMock.mock.calls[1];
		const putBody = JSON.parse(putCall[1].body);
		expect(putBody.metadata_public.theme).toBe("dark");
		expect(putBody.metadata_public.oldLayout).toBe("keep-me");
		expect(putBody.metadata_public.dashboardLayout).toEqual({ rows: [{ id: "new" }] });
		expect(putBody.metadata_admin).toEqual({ note: "admin note" });
	});

	it("treats missing metadata_public as empty object", async () => {
		const cookie = await validCookie();
		const existingIdentity = {
			schema_id: "default",
			traits: { email: "admin@example.com" },
			// no metadata_public
			state: "active",
		};
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(existingIdentity) })
			.mockResolvedValueOnce({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		const req = buildRequest("PUT", "http://localhost:4001/api/dashboard/layout", {
			body: { layout: { rows: [{ id: "new" }] } },
			cookies: { "athena-session": cookie },
		});
		const res = await PUT(req);
		expect(res.status).toBe(200);
	});

	it("returns 500 when update PUT returns non-ok", async () => {
		const cookie = await validCookie();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ schema_id: "s", traits: {} }) })
			.mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve("bad") });
		vi.stubGlobal("fetch", fetchMock);
		const req = buildRequest("PUT", "http://localhost:4001/api/dashboard/layout", {
			body: { layout: { rows: [] } },
			cookies: { "athena-session": cookie },
		});
		const res = await PUT(req);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Failed to save layout");
	});

	it("returns 504 on TimeoutError", async () => {
		const cookie = await validCookie();
		const timeoutError = new Error("timed out");
		timeoutError.name = "TimeoutError";
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutError));
		const req = buildRequest("PUT", "http://localhost:4001/api/dashboard/layout", {
			body: { layout: { rows: [] } },
			cookies: { "athena-session": cookie },
		});
		const res = await PUT(req);
		expect(res.status).toBe(504);
		const body = await res.json();
		expect(body.error).toBe("Gateway Timeout");
	});

	it("returns 500 on generic PUT error", async () => {
		const cookie = await validCookie();
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
		const req = buildRequest("PUT", "http://localhost:4001/api/dashboard/layout", {
			body: { layout: { rows: [] } },
			cookies: { "athena-session": cookie },
		});
		const res = await PUT(req);
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).toBe("Internal server error");
	});

	it("uses default timeout when PROXY_TIMEOUT_MS unset", async () => {
		delete process.env.PROXY_TIMEOUT_MS;
		const cookie = await validCookie();
		const existing = { schema_id: "s", traits: {}, metadata_public: null };
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(existing) })
			.mockResolvedValueOnce({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		const req = buildRequest("PUT", "http://localhost:4001/api/dashboard/layout", {
			body: { layout: { rows: [] } },
			cookies: { "athena-session": cookie },
		});
		const res = await PUT(req);
		expect(res.status).toBe(200);
	});
});

describe("GET /api/dashboard/layout — env edge cases", () => {
	it("uses default PROXY_TIMEOUT_MS when unset", async () => {
		delete process.env.PROXY_TIMEOUT_MS;
		const cookie = await validCookie();
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
		const req = buildRequest("GET", "http://localhost:4001/api/dashboard/layout", {
			cookies: { "athena-session": cookie },
		});
		const res = await GET(req);
		expect(res.status).toBe(200);
	});
});
