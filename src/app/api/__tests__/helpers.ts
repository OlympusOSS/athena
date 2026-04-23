/**
 * Shared test helpers for API route tests.
 *
 * Provides small factories for building NextRequest-like objects with cookies
 * and headers, plus common mock scaffolds for external services (Kratos/Hydra/
 * fetch/SDK). API route handlers under src/app/api/**\/route.ts are exported
 * named functions, so tests can call them directly — these helpers remove the
 * boilerplate of constructing Request instances and setting up the typical
 * mock chain.
 *
 * Used by the Phase 3 coverage tests. All helpers are deliberately minimal —
 * tests may compose them or inline custom fetch mocks when needed.
 */

import type { NextRequest } from "next/server";
import { vi } from "vitest";

/**
 * Build a NextRequest-compatible object that API route handlers can consume.
 *
 * Supports:
 *   - method, URL
 *   - JSON body (auto stringified)
 *   - headers (e.g. x-user-id, x-user-email injected by middleware)
 *   - cookies (exposed via req.cookies.get(name)?.value)
 *
 * Returns a Request cast to NextRequest for type compatibility. The real
 * Next.js request object has additional fields (nextUrl, cookies) — only the
 * bits handlers actually consume are populated here.
 */
export interface BuildRequestOptions {
	body?: unknown;
	headers?: Record<string, string>;
	cookies?: Record<string, string>;
}

export function buildRequest(method: string, url: string, opts: BuildRequestOptions = {}): NextRequest {
	const headers = new Headers({
		"Content-Type": "application/json",
		...(opts.headers ?? {}),
	});

	// Serialize cookies into a Cookie header so Request parsing sees them.
	if (opts.cookies) {
		const cookieString = Object.entries(opts.cookies)
			.map(([k, v]) => `${k}=${v}`)
			.join("; ");
		if (cookieString) {
			headers.set("cookie", cookieString);
		}
	}

	const init: RequestInit = { method, headers };
	if (opts.body !== undefined) {
		init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
	}

	const req = new Request(url, init);

	// Cast Request to NextRequest. Next.js adds `nextUrl` and `cookies` fields;
	// provide those here so handlers that depend on them still work. For routes
	// that read `request.cookies.get(...)` we attach a cookie-map accessor.
	const cookieMap = new Map<string, string>(Object.entries(opts.cookies ?? {}));
	const nextReq = req as unknown as NextRequest & {
		cookies: { get: (n: string) => { value: string } | undefined };
		nextUrl: URL;
	};

	Object.defineProperty(nextReq, "cookies", {
		value: {
			get: (name: string) => {
				const val = cookieMap.get(name);
				return val !== undefined ? { value: val } : undefined;
			},
		},
		configurable: true,
	});

	Object.defineProperty(nextReq, "nextUrl", {
		value: new URL(url),
		configurable: true,
	});

	return nextReq;
}

/**
 * Build a mock @ory/kratos-client IdentityApi. All methods are vi.fn() — tests
 * override the specific ones they care about with mockResolvedValue/etc.
 */
export function createKratosMock() {
	return {
		listIdentities: vi.fn(),
		getIdentity: vi.fn(),
		createIdentity: vi.fn(),
		patchIdentity: vi.fn(),
		updateIdentity: vi.fn(),
		deleteIdentity: vi.fn(),
		deleteIdentityCredentials: vi.fn(),
		createRecoveryLinkForIdentity: vi.fn(),
	};
}

/**
 * Build a mock @ory/hydra-client OAuth2Api. Matches the subset of methods used
 * by src/services/hydra.
 */
export function createHydraMock() {
	return {
		listOAuth2Clients: vi.fn(),
		getOAuth2Client: vi.fn(),
		createOAuth2Client: vi.fn(),
		setOAuth2Client: vi.fn(),
		patchOAuth2Client: vi.fn(),
		deleteOAuth2Client: vi.fn(),
	};
}

/**
 * Build a mock for src/lib/http-client style clients (Kratos/Hydra HTTP
 * wrappers). Each method returns a resolved Response-like object by default.
 */
export function createHttpClientMock() {
	return {
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		patch: vi.fn(),
		delete: vi.fn(),
	};
}

/**
 * Stub global.fetch to return a chain of mock responses in order.
 *
 * Example:
 *   stubFetchSequence([
 *     { ok: true, status: 200, json: { data: [] } },
 *     { ok: false, status: 500, text: "server error" },
 *   ]);
 */
export interface MockFetchResponse {
	ok: boolean;
	status?: number;
	json?: unknown;
	text?: string;
}

export function stubFetchSequence(responses: MockFetchResponse[]) {
	const fn = vi.fn();
	for (const r of responses) {
		fn.mockResolvedValueOnce({
			ok: r.ok,
			status: r.status ?? (r.ok ? 200 : 500),
			json: vi.fn().mockResolvedValue(r.json ?? {}),
			text: vi.fn().mockResolvedValue(r.text ?? ""),
		});
	}
	vi.stubGlobal("fetch", fn);
	return fn;
}
