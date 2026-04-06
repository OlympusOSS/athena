/**
 * GET /api/connections/public
 *
 * Unauthenticated public endpoint consumed by Hera to fetch enabled social
 * providers for rendering login buttons.
 *
 * This is a SEPARATE route from /api/connections/social (G2 requirement):
 * - NOT in ADMIN_PREFIXES — no admin session required
 * - IS in isPublicRoute() in middleware.ts — auth enforcement is bypassed
 * - Returns ONLY { provider, display_name, enabled } — no credentials
 *
 * Security (V9 / platform#15 Condition 2):
 * Response normalization: "not configured" and "configured but disabled"
 * produce IDENTICAL output — the provider is absent from the array.
 * This prevents info leakage about whether a provider was ever set up.
 *
 * Hera integration contract:
 * URL: /api/connections/public
 * Response: { providers: Array of { provider, display_name, enabled } } — only enabled=true providers
 */

import { listSettings } from "@olympusoss/sdk";
import { NextResponse } from "next/server";
import { toPublicConnection } from "@/lib/social-connections/serializers";
import { ALLOWED_PROVIDERS, DISPLAY_NAME_BY_PROVIDER, type SocialProvider } from "@/lib/social-connections/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/connections/public
 *
 * Returns only enabled social providers. Safe fields only: provider, display_name, enabled.
 * No authentication required.
 */
export async function GET(_request: Request) {
	try {
		// Read all social.* settings from SDK
		const allSettings = await listSettings("social");

		// Group by provider, collect enabled state
		const byProvider: Record<string, Record<string, string>> = {};
		for (const setting of allSettings) {
			const parts = setting.key.split(".");
			if (parts.length !== 3 || parts[0] !== "social") continue;
			const provider = parts[1];
			const field = parts[2];
			if (!byProvider[provider]) byProvider[provider] = {};
			byProvider[provider][field] = setting.value;
		}

		// Build public view — only allowed providers that are fully configured AND enabled
		// V9: providers that are configured-but-disabled are treated identically to unconfigured
		const enabledProviders = ALLOWED_PROVIDERS.filter((provider: SocialProvider) => {
			const fields = byProvider[provider];
			if (!fields) return false;
			if (!fields.client_id) return false; // Not configured
			return fields.enabled === "true"; // Must be explicitly enabled
		});

		const result = enabledProviders.map((provider: SocialProvider) => {
			const fields = byProvider[provider];
			return toPublicConnection({
				provider,
				display_name: fields?.display_name ?? DISPLAY_NAME_BY_PROVIDER[provider],
				enabled: true,
			});
		});

		return NextResponse.json({ providers: result });
	} catch (error) {
		console.error("[api/connections/public] GET failed:", {
			message: error instanceof Error ? error.message : String(error),
		});
		return NextResponse.json({ error: "Failed to load social connections" }, { status: 500 });
	}
}
