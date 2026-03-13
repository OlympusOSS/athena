import { getSettingOrDefault } from "@olympusoss/sdk";
import { NextResponse } from "next/server";
import { encryptApiKey } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/** Read a vault setting with env var fallback. Silently falls back on errors. */
async function vaultOrEnv(key: string, envFallback: string): Promise<string> {
	try {
		return await getSettingOrDefault(key, envFallback);
	} catch {
		return envFallback;
	}
}

export async function GET() {
	// Get API keys from env and encrypt them
	const kratosApiKey = process.env.KRATOS_API_KEY || process.env.ORY_API_KEY || "";
	const hydraApiKey = process.env.HYDRA_API_KEY || process.env.ORY_API_KEY || "";

	// HYDRA_ENABLED defaults to true for backwards compatibility
	// Set to "false" to disable Hydra integration
	const hydraEnabled = process.env.HYDRA_ENABLED !== "false";

	// CAPTCHA — vault value takes priority over env var
	const captchaEnabled = await vaultOrEnv("captcha.enabled", process.env.CAPTCHA_ENABLED || "false");
	const captchaSiteKey = await vaultOrEnv("captcha.site_key", process.env.CAPTCHA_SITE_KEY || "");

	const config = {
		kratosPublicUrl: process.env.KRATOS_PUBLIC_URL || "http://localhost:3100",
		kratosAdminUrl: process.env.KRATOS_ADMIN_URL || "http://localhost:3101",
		kratosApiKey: encryptApiKey(kratosApiKey),
		hydraPublicUrl: process.env.HYDRA_PUBLIC_URL || "http://localhost:3102",
		hydraAdminUrl: process.env.HYDRA_ADMIN_URL || "http://localhost:3103",
		hydraApiKey: encryptApiKey(hydraApiKey),
		isOryNetwork: process.env.IS_ORY_NETWORK === "true",
		hydraEnabled,
		defaultClientId: process.env.DEFAULT_CLIENT_ID || "",
		captchaEnabled: captchaEnabled === "true",
		captchaSiteKey,
	};

	return NextResponse.json(config);
}
