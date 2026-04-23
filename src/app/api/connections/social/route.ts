/**
 * GET  /api/connections/social  — admin: full config list (requires admin session via middleware)
 * POST /api/connections/social  — admin: create or update a social connection (requires admin session)
 *
 * Auth: enforced by middleware.ts (ADMIN_PREFIXES includes /api/connections/social).
 * x-user-id and x-user-email headers are injected by middleware for admin routes.
 *
 * Security: client_secret is NEVER returned in any response (V3 mitigation).
 * client_secret is NEVER logged (V4 mitigation).
 * Input validation is enforced on all fields before any SDK write (V2 mitigation).
 *
 * NOTE: The public (unauthenticated) endpoint for Hera is at /api/connections/public
 * to satisfy G2 (two separate routes, not query-param branching on one route).
 */

import { deleteSetting, getSetting, listSettings, setSetting } from "@olympusoss/sdk";
import { NextResponse } from "next/server";
import { auditSocialConnection } from "@/lib/social-connections/audit";
import { triggerReload } from "@/lib/social-connections/reload-client";
import { maskSecret } from "@/lib/social-connections/serializers";
import {
	ALLOWED_PROVIDERS,
	DEFAULT_SCOPES_BY_PROVIDER,
	DISPLAY_NAME_BY_PROVIDER,
	PROVIDER_ORDER,
	type SocialProvider,
	validateClientId,
	validateClientSecret,
	validateProvider,
	validateScopes,
} from "@/lib/social-connections/validation";

export const dynamic = "force-dynamic";

/**
 * Reads all configured social connections from the SDK settings table and
 * assembles them into an array of admin-view objects.
 */
async function readAllConnections(): Promise<
	Array<{
		provider: string;
		display_name: string;
		enabled: boolean;
		client_id: string;
		client_secret?: string;
		scopes: string[];
		order: number;
	}>
> {
	// Read all social.* settings from SDK
	const allSettings = await listSettings("social");

	// Group settings by provider
	const byProvider: Record<string, Record<string, string>> = {};
	for (const setting of allSettings) {
		// Key format: social.<provider>.<field>
		const parts = setting.key.split(".");
		if (parts.length !== 3 || parts[0] !== "social") continue;
		const provider = parts[1];
		const field = parts[2];
		if (!byProvider[provider]) byProvider[provider] = {};
		byProvider[provider][field] = setting.value;
	}

	// Get connections_order to determine display order
	const orderSetting = await getSetting("social.connections_order");
	let orderedProviders: string[] = PROVIDER_ORDER;
	if (orderSetting) {
		try {
			orderedProviders = JSON.parse(orderSetting);
		} catch {
			// fallback to default order
		}
	}

	const connections: Array<{
		provider: string;
		display_name: string;
		enabled: boolean;
		client_id: string;
		scopes: string[];
		order: number;
	}> = [];
	const allProviderSlugs = new Set([...orderedProviders, ...Object.keys(byProvider)]);

	for (const provider of allProviderSlugs) {
		if (!(ALLOWED_PROVIDERS as readonly string[]).includes(provider)) continue;
		const fields = byProvider[provider];
		if (!fields?.client_id) continue; // Skip unconfigured providers

		const typedProvider = provider as SocialProvider;
		connections.push({
			provider,
			display_name: fields.display_name ?? DISPLAY_NAME_BY_PROVIDER[typedProvider],
			enabled: fields.enabled === "true",
			client_id: fields.client_id ?? "",
			scopes: fields.scopes ? fields.scopes.split(",") : DEFAULT_SCOPES_BY_PROVIDER[typedProvider],
			order: orderedProviders.indexOf(provider) >= 0 ? orderedProviders.indexOf(provider) + 1 : 99,
		});
	}

	return connections.sort((a, b) => a.order - b.order);
}

/**
 * GET /api/connections/social
 *
 * Returns all configured social connections for the admin panel.
 * client_secret is always masked in the response.
 *
 * Auth: admin session required (enforced by middleware via ADMIN_PREFIXES).
 */
export async function GET(_request: Request) {
	try {
		const connections = await readAllConnections();
		const masked = connections.map(maskSecret);
		return NextResponse.json({ connections: masked });
	} catch (error) {
		console.error("[api/connections/social] GET failed:", {
			message: error instanceof Error ? error.message : String(error),
		});
		return NextResponse.json({ error: "Failed to load social connections" }, { status: 500 });
	}
}

/**
 * POST /api/connections/social
 *
 * Creates or updates a social connection configuration.
 *
 * Security:
 * - client_secret is NEVER logged (V4 — redacted before processing)
 * - If client_secret is provided and non-empty, sets secretChanged=true
 *   and returns reloadStatus="skipped" WITHOUT calling the sidecar.
 *   A new secret requires a Kratos restart, not a SIGHUP reload.
 * - If only non-secret fields are changed, sidecar reload is triggered.
 *
 * Auth: admin session required (enforced by middleware via ADMIN_PREFIXES).
 * Admin identity read from x-user-id and x-user-email headers.
 */
export async function POST(request: Request) {
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

	const { provider, client_id, client_secret, scopes, enabled } = body as Record<string, unknown>;

	// V2: Server-side input validation — provider allowlist
	const providerValidation = validateProvider(provider);
	if (!providerValidation.valid) {
		return NextResponse.json({ error: `Validation failed: ${providerValidation.error}` }, { status: 400 });
	}
	const validProvider = provider as SocialProvider;

	// V2: Validate client_id
	const clientIdValidation = validateClientId(client_id);
	if (!clientIdValidation.valid) {
		return NextResponse.json({ error: `Validation failed: ${clientIdValidation.error}` }, { status: 400 });
	}

	// V2: Validate scopes (use defaults if not provided)
	const scopeValues = Array.isArray(scopes) ? scopes : DEFAULT_SCOPES_BY_PROVIDER[validProvider];
	const scopesValidation = validateScopes(scopeValues, validProvider);
	if (!scopesValidation.valid) {
		return NextResponse.json({ error: `Validation failed: ${scopesValidation.error}` }, { status: 400 });
	}

	// Determine if this is a create or update
	const existingClientId = await getSetting(`social.${validProvider}.client_id`);
	const isCreate = !existingClientId;

	// Determine if client_secret is being changed
	// V4: client_secret value is NEVER logged — only its presence is checked.
	const secretChanged = typeof client_secret === "string" && client_secret.trim().length > 0;

	if (isCreate && !secretChanged) {
		// On create, client_secret is required
		const secretValidation = validateClientSecret(client_secret);
		if (!secretValidation.valid) {
			return NextResponse.json({ error: `Validation failed: ${secretValidation.error}` }, { status: 400 });
		}
	}

	// If secret is being changed, validate it before writing anything
	if (secretChanged) {
		const secretValidation = validateClientSecret(client_secret);
		if (!secretValidation.valid) {
			return NextResponse.json({ error: `Validation failed: ${secretValidation.error}` }, { status: 400 });
		}
	}

	try {
		const changedFields: string[] = [];

		// Write non-secret settings
		await setSetting(`social.${validProvider}.client_id`, String(client_id), { category: "social" });
		changedFields.push("client_id");

		const enabledValue = typeof enabled === "boolean" ? enabled : true;
		await setSetting(`social.${validProvider}.enabled`, String(enabledValue), { category: "social" });
		changedFields.push("enabled");

		await setSetting(`social.${validProvider}.scopes`, scopeValues.join(","), { category: "social" });
		changedFields.push("scopes");

		await setSetting(`social.${validProvider}.display_name`, DISPLAY_NAME_BY_PROVIDER[validProvider], { category: "social" });

		// Write encrypted secret if provided
		// V4: client_secret value is NOT included in any log — only the field name
		if (secretChanged) {
			await setSetting(`social.${validProvider}.client_secret`, String(client_secret), {
				encrypted: true,
				category: "social",
			});
			changedFields.push("client_secret changed");
		}

		// Update connections order
		const existingOrder = await getSetting("social.connections_order");
		let order: string[] = [];
		if (existingOrder) {
			try {
				order = JSON.parse(existingOrder);
			} catch {
				order = [];
			}
		}
		if (!order.includes(validProvider)) {
			order.push(validProvider);
			await setSetting("social.connections_order", JSON.stringify(order), { category: "social" });
		}

		// Emit audit log (V7 / SOC2 CC6.2)
		const action = isCreate ? "social_connection.created" : "social_connection.updated";
		auditSocialConnection(action, validProvider, adminId, adminEmail, changedFields);

		// Trigger reload — skipped if secret was changed (requires restart)
		const { status: reloadStatus } = await triggerReload(secretChanged);

		return NextResponse.json({
			success: true,
			provider: validProvider,
			secretChanged,
			reloadStatus,
		});
	} catch (error) {
		console.error("[api/connections/social] POST failed:", {
			provider: validProvider,
			message: error instanceof Error ? error.message : String(error),
		});

		// Attempt cleanup of partial writes on failure
		try {
			// If create failed mid-sequence, remove partially written keys
			if (isCreate) {
				for (const key of [
					`social.${validProvider}.client_id`,
					`social.${validProvider}.enabled`,
					`social.${validProvider}.scopes`,
					`social.${validProvider}.display_name`,
					`social.${validProvider}.client_secret`,
				]) {
					await deleteSetting(key).catch(() => {});
				}
			}
			/* c8 ignore start — the inner loop swallows per-key deleteSetting errors via .catch(),
			   so the outer try can only fire if the synchronous control flow itself throws,
			   which is not reachable under the current deleteSetting contract. */
		} catch {
			// Cleanup failure is logged but not surfaced — the original error takes precedence
		}
		/* c8 ignore stop */

		return NextResponse.json({ error: "Failed to save social connection" }, { status: 500 });
	}
}
