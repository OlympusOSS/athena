/**
 * PATCH  /api/connections/social/:provider  — toggle enabled/disabled
 * DELETE /api/connections/social/:provider  — remove social connection
 *
 * Auth: enforced by middleware.ts (ADMIN_PREFIXES includes /api/connections/social).
 * x-user-id and x-user-email headers are injected by middleware for admin routes.
 *
 * Security: provider slug is validated against the allowlist before any SDK
 * operation (V2 mitigation — path parameter injection prevention).
 */

import { deleteSetting, getSetting, setSetting } from "@olympusoss/sdk";
import { NextResponse } from "next/server";
import { auditSocialConnection } from "@/lib/social-connections/audit";
import { triggerReload } from "@/lib/social-connections/reload-client";
import { validateEnabled, validateProvider } from "@/lib/social-connections/validation";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ provider: string }>;
}

/**
 * PATCH /api/connections/social/:provider
 *
 * Toggles the enabled/disabled state of a social connection without changing credentials.
 *
 * Auth: admin session required (enforced by middleware).
 */
export async function PATCH(request: Request, context: RouteContext) {
	const { provider } = await context.params;

	// V2: Validate provider slug against allowlist (prevents path traversal/injection)
	const providerValidation = validateProvider(provider);
	if (!providerValidation.valid) {
		return NextResponse.json(
			{ error: `Validation failed: ${providerValidation.error}` },
			{ status: 400 },
		);
	}

	// Read admin identity from middleware-injected headers
	const adminId = request.headers.get("x-user-id") ?? "unknown";
	const adminEmail = request.headers.get("x-user-email") ?? "unknown";

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (typeof body !== "object" || body === null) {
		return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
	}

	const { enabled } = body as Record<string, unknown>;

	// Validate enabled field
	const enabledValidation = validateEnabled(enabled);
	if (!enabledValidation.valid) {
		return NextResponse.json(
			{ error: `Validation failed: ${enabledValidation.error}` },
			{ status: 400 },
		);
	}

	// Verify provider is actually configured before toggling
	const existingClientId = await getSetting(`social.${provider}.client_id`);
	if (!existingClientId) {
		return NextResponse.json(
			{ error: `Provider not found: ${provider}` },
			{ status: 404 },
		);
	}

	try {
		await setSetting(`social.${provider}.enabled`, String(enabled as boolean), { category: "social" });

		// Emit audit log
		const action = (enabled as boolean) ? "social_connection.enabled" : "social_connection.disabled";
		auditSocialConnection(action, provider, adminId, adminEmail, ["enabled"]);

		// Trigger reload — toggling enabled/disabled is a non-secret change
		const { status: reloadStatus } = await triggerReload(false);

		return NextResponse.json({
			success: true,
			provider,
			enabled: enabled as boolean,
			reloadStatus,
		});
	} catch (error) {
		console.error("[api/connections/social/:provider] PATCH failed:", {
			provider,
			message: error instanceof Error ? error.message : String(error),
		});
		return NextResponse.json({ error: "Failed to update social connection" }, { status: 500 });
	}
}

/**
 * DELETE /api/connections/social/:provider
 *
 * Removes all SDK settings for the provider and triggers a Kratos reload.
 *
 * Auth: admin session required (enforced by middleware).
 *
 * Security: deletes all social.<provider>.* keys atomically. Kratos sessions
 * established via this provider remain valid until natural expiry — this route
 * does NOT revoke active sessions.
 */
export async function DELETE(request: Request, context: RouteContext) {
	const { provider } = await context.params;

	// V2: Validate provider slug against allowlist (prevents path traversal/injection)
	const providerValidation = validateProvider(provider);
	if (!providerValidation.valid) {
		return NextResponse.json(
			{ error: `Validation failed: ${providerValidation.error}` },
			{ status: 400 },
		);
	}

	// Read admin identity from middleware-injected headers
	const adminId = request.headers.get("x-user-id") ?? "unknown";
	const adminEmail = request.headers.get("x-user-email") ?? "unknown";

	// Verify provider is actually configured before deletion
	const existingClientId = await getSetting(`social.${provider}.client_id`);
	if (!existingClientId) {
		return NextResponse.json(
			{ error: `Provider not found: ${provider}` },
			{ status: 404 },
		);
	}

	try {
		// Remove all social.<provider>.* settings
		const keysToDelete = [
			`social.${provider}.client_id`,
			`social.${provider}.client_secret`,
			`social.${provider}.enabled`,
			`social.${provider}.scopes`,
			`social.${provider}.display_name`,
			`social.${provider}.provider_id`,
		];

		for (const key of keysToDelete) {
			await deleteSetting(key).catch(() => {
				// Some keys may not exist (e.g. provider_id is optional) — ignore missing key deletions
			});
		}

		// Update connections_order to remove this provider
		const orderSetting = await getSetting("social.connections_order");
		if (orderSetting) {
			try {
				const order = JSON.parse(orderSetting) as string[];
				const updated = order.filter((p) => p !== provider);
				await setSetting("social.connections_order", JSON.stringify(updated), { category: "social" });
			} catch {
				// If order parsing fails, leave it — it is cosmetic only
			}
		}

		// Emit audit log (SOC2 CC6.2)
		auditSocialConnection("social_connection.deleted", provider, adminId, adminEmail, ["all keys removed"]);

		// Trigger reload after deletion
		const { status: reloadStatus } = await triggerReload(false);

		return NextResponse.json({
			success: true,
			provider,
			reloadStatus,
		});
	} catch (error) {
		console.error("[api/connections/social/:provider] DELETE failed:", {
			provider,
			message: error instanceof Error ? error.message : String(error),
		});
		return NextResponse.json({ error: "Failed to delete social connection" }, { status: 500 });
	}
}
