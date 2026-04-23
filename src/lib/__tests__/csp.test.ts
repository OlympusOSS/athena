/**
 * Unit tests for src/lib/csp.ts — athena#108
 *
 * Covers:
 *   - buildCsp() in development: script-src includes 'unsafe-eval'
 *   - buildCsp() in production: script-src does NOT include 'unsafe-eval'
 *   - Dev and prod CSPs differ ONLY by the 'unsafe-eval' token
 *   - Nonce is correctly embedded in script-src
 *   - All required directives are present
 *   - NODE_ENV is restored after each test (no cross-test pollution)
 */

import { afterEach, describe, expect, it } from "vitest";
import { buildCsp } from "@/lib/csp";

const originalEnv = { ...process.env };

afterEach(() => {
	process.env = { ...originalEnv };
	process.env.ENCRYPTION_KEY = "test-encryption-key-for-vitest-32ch";
	process.env.SESSION_SIGNING_KEY = "y0vXvDE6hGnlA4J/iLlTwyMXHgDrMp4tD3ON+3lf3ws=";
	process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4001";
	process.env.TZ = "UTC";
});

describe("buildCsp — dev vs production", () => {
	it("includes 'unsafe-eval' in script-src when NODE_ENV=development", () => {
		process.env.NODE_ENV = "development";
		const csp = buildCsp("test-nonce-dev");
		expect(csp).toContain("'unsafe-eval'");
		expect(csp).toContain("script-src 'self' 'nonce-test-nonce-dev' 'unsafe-eval'");
	});

	it("does NOT include 'unsafe-eval' when NODE_ENV=production", () => {
		process.env.NODE_ENV = "production";
		const csp = buildCsp("test-nonce-prod");
		expect(csp).not.toContain("unsafe-eval");
		expect(csp).toContain("script-src 'self' 'nonce-test-nonce-prod'");
	});

	it("dev and prod CSPs differ ONLY by the 'unsafe-eval' token", () => {
		const nonce = "diff-test-nonce";

		process.env.NODE_ENV = "development";
		const devCsp = buildCsp(nonce);

		process.env.NODE_ENV = "production";
		const prodCsp = buildCsp(nonce);

		// Remove the unsafe-eval token from dev CSP — result should match prod CSP
		const devWithoutEval = devCsp.replace(" 'unsafe-eval'", "");
		expect(devWithoutEval).toBe(prodCsp);
	});
});

describe("buildCsp — nonce embedding", () => {
	it("embeds the nonce in script-src directive", () => {
		process.env.NODE_ENV = "production";
		const csp = buildCsp("abc123");
		expect(csp).toContain("'nonce-abc123'");
	});

	it("uses a unique nonce per call", () => {
		process.env.NODE_ENV = "production";
		const csp1 = buildCsp("nonce-aaa");
		const csp2 = buildCsp("nonce-bbb");
		expect(csp1).toContain("'nonce-nonce-aaa'");
		expect(csp2).toContain("'nonce-nonce-bbb'");
		expect(csp1).not.toBe(csp2);
	});
});

describe("buildCsp — required directives", () => {
	it("includes all security directives", () => {
		process.env.NODE_ENV = "production";
		const csp = buildCsp("directive-test");

		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("style-src 'self' 'unsafe-inline'");
		expect(csp).toContain("connect-src 'self'");
		expect(csp).toContain("img-src 'self' data:");
		expect(csp).toContain("font-src 'self'");
		expect(csp).toContain("object-src 'none'");
		expect(csp).toContain("base-uri 'self'");
		expect(csp).toContain("form-action 'self'");
		expect(csp).toContain("frame-ancestors 'none'");
	});

	it("joins directives with semicolon-space separator", () => {
		process.env.NODE_ENV = "production";
		const csp = buildCsp("sep-test");
		// Should be semicolon-space separated, not double-semicolons
		expect(csp).not.toContain(";;");
		// Each directive should be separated by "; "
		const parts = csp.split("; ");
		expect(parts.length).toBeGreaterThanOrEqual(10);
	});
});
