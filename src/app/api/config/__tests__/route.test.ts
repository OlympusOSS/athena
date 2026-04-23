/**
 * Unit tests for GET /api/config
 *
 * Exercises:
 *   - All env var default branches
 *   - Env var overrides for URLs
 *   - API key env fallback chain (KRATOS_API_KEY → ORY_API_KEY → "")
 *   - HYDRA_ENABLED toggle (default true, "false" disables)
 *   - CAPTCHA vault-or-env behaviour (primary + fallback + thrown)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const { mockGetSettingOrDefault, mockEncryptApiKey } = vi.hoisted(() => ({
	mockGetSettingOrDefault: vi.fn(),
	mockEncryptApiKey: vi.fn(),
}));

vi.mock("@olympusoss/sdk", () => ({
	getSettingOrDefault: mockGetSettingOrDefault,
}));

vi.mock("@/lib/crypto", () => ({
	encryptApiKey: mockEncryptApiKey,
}));

const originalEnv = { ...process.env };

beforeEach(() => {
	process.env = { ...originalEnv };
	process.env.ENCRYPTION_KEY = "test-encryption-key-for-vitest-32ch";
	process.env.SESSION_SIGNING_KEY = "y0vXvDE6hGnlA4J/iLlTwyMXHgDrMp4tD3ON+3lf3ws=";
	process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4001";
	process.env.TZ = "UTC";
	vi.clearAllMocks();
	// Default: vault returns the env fallback unchanged
	mockGetSettingOrDefault.mockImplementation(async (_key: string, fallback: string) => fallback);
	mockEncryptApiKey.mockImplementation((value: string) => `enc:${value}`);
});

afterEach(() => {
	process.env = { ...originalEnv };
	process.env.ENCRYPTION_KEY = "test-encryption-key-for-vitest-32ch";
	process.env.SESSION_SIGNING_KEY = "y0vXvDE6hGnlA4J/iLlTwyMXHgDrMp4tD3ON+3lf3ws=";
	process.env.NEXT_PUBLIC_APP_URL = "http://localhost:4001";
	process.env.TZ = "UTC";
});

describe("GET /api/config", () => {
	it("returns default values when all env vars are unset", async () => {
		delete process.env.KRATOS_PUBLIC_URL;
		delete process.env.KRATOS_ADMIN_URL;
		delete process.env.HYDRA_PUBLIC_URL;
		delete process.env.HYDRA_ADMIN_URL;
		delete process.env.KRATOS_API_KEY;
		delete process.env.ORY_API_KEY;
		delete process.env.HYDRA_API_KEY;
		delete process.env.HYDRA_ENABLED;
		delete process.env.DEFAULT_CLIENT_ID;
		delete process.env.IS_ORY_NETWORK;
		delete process.env.CAPTCHA_ENABLED;
		delete process.env.CAPTCHA_SITE_KEY;
		const res = await GET();
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.kratosPublicUrl).toBe("http://localhost:3100");
		expect(body.kratosAdminUrl).toBe("http://localhost:3101");
		expect(body.hydraPublicUrl).toBe("http://localhost:3102");
		expect(body.hydraAdminUrl).toBe("http://localhost:3103");
		expect(body.isOryNetwork).toBe(false);
		expect(body.hydraEnabled).toBe(true); // default true
		expect(body.defaultClientId).toBe("");
		expect(body.captchaEnabled).toBe(false);
		expect(body.captchaSiteKey).toBe("");
		expect(body.kratosApiKey).toBe("enc:");
		expect(body.hydraApiKey).toBe("enc:");
	});

	it("uses env vars when provided", async () => {
		process.env.KRATOS_PUBLIC_URL = "https://kratos.example.com";
		process.env.KRATOS_ADMIN_URL = "https://kratos-admin.example.com";
		process.env.HYDRA_PUBLIC_URL = "https://hydra.example.com";
		process.env.HYDRA_ADMIN_URL = "https://hydra-admin.example.com";
		process.env.KRATOS_API_KEY = "kratos-key";
		process.env.HYDRA_API_KEY = "hydra-key";
		process.env.IS_ORY_NETWORK = "true";
		process.env.DEFAULT_CLIENT_ID = "my-client";
		const res = await GET();
		const body = await res.json();
		expect(body.kratosPublicUrl).toBe("https://kratos.example.com");
		expect(body.hydraPublicUrl).toBe("https://hydra.example.com");
		expect(body.isOryNetwork).toBe(true);
		expect(body.defaultClientId).toBe("my-client");
		expect(body.kratosApiKey).toBe("enc:kratos-key");
		expect(body.hydraApiKey).toBe("enc:hydra-key");
	});

	it("uses ORY_API_KEY as fallback when KRATOS_API_KEY and HYDRA_API_KEY are unset", async () => {
		delete process.env.KRATOS_API_KEY;
		delete process.env.HYDRA_API_KEY;
		process.env.ORY_API_KEY = "ory-fallback";
		const res = await GET();
		const body = await res.json();
		expect(body.kratosApiKey).toBe("enc:ory-fallback");
		expect(body.hydraApiKey).toBe("enc:ory-fallback");
	});

	it("disables hydra when HYDRA_ENABLED is exactly 'false'", async () => {
		process.env.HYDRA_ENABLED = "false";
		const res = await GET();
		const body = await res.json();
		expect(body.hydraEnabled).toBe(false);
	});

	it("enables hydra when HYDRA_ENABLED is anything other than 'false'", async () => {
		process.env.HYDRA_ENABLED = "true";
		let res = await GET();
		expect((await res.json()).hydraEnabled).toBe(true);

		process.env.HYDRA_ENABLED = "1";
		res = await GET();
		expect((await res.json()).hydraEnabled).toBe(true);
	});

	it("uses vault CAPTCHA settings when available", async () => {
		mockGetSettingOrDefault.mockImplementation(async (key: string, fallback: string) => {
			if (key === "captcha.enabled") return "true";
			if (key === "captcha.site_key") return "vault-site-key";
			return fallback;
		});
		const res = await GET();
		const body = await res.json();
		expect(body.captchaEnabled).toBe(true);
		expect(body.captchaSiteKey).toBe("vault-site-key");
	});

	it("falls back to env vars for CAPTCHA when vault throws", async () => {
		mockGetSettingOrDefault.mockRejectedValue(new Error("vault down"));
		process.env.CAPTCHA_ENABLED = "true";
		process.env.CAPTCHA_SITE_KEY = "env-site-key";
		const res = await GET();
		const body = await res.json();
		expect(body.captchaEnabled).toBe(true);
		expect(body.captchaSiteKey).toBe("env-site-key");
	});

	it("falls back to env defaults when vault and env are unset", async () => {
		mockGetSettingOrDefault.mockRejectedValue(new Error("vault down"));
		delete process.env.CAPTCHA_ENABLED;
		delete process.env.CAPTCHA_SITE_KEY;
		const res = await GET();
		const body = await res.json();
		expect(body.captchaEnabled).toBe(false);
		expect(body.captchaSiteKey).toBe("");
	});
});
