import { batchSetSettings, getSettingOrDefault } from "@olympusoss/sdk";
import { NextResponse } from "next/server";
import { parseMfaMethods } from "@/lib/mfa-methods";

export const dynamic = "force-dynamic";

const SETTINGS_TABLE = process.env.SETTINGS_TABLE || "ciam_settings";

// Guard: max 20 entries per batch (SDK comment in batchSetSettings notes this limit).
const MAX_BATCH_SIZE = 20;

/**
 * Guard C (SR-MFA-1): MFA invariant check.
 *
 * Triggered only when the batch payload contains at least one `mfa.` prefixed key.
 * Validates the *resulting state* (payload merged over persisted values) to prevent
 * mfa.require_mfa=true with no methods enabled.
 *
 * Returns a 400 NextResponse if the invariant is violated, or null if the guard passes.
 * When a non-null response is returned, NO settings have been written.
 */
async function checkMfaInvariant(payloadMap: Map<string, string>): Promise<NextResponse | null> {
	// Only trigger when the batch touches mfa.* keys
	const hasMfaKeys = Array.from(payloadMap.keys()).some((k) => k.startsWith("mfa."));
	if (!hasMfaKeys) return null;

	// Step 1: Get submitted values (payload takes precedence over DB)
	const submittedRequire = payloadMap.get("mfa.require_mfa");
	const submittedMethods = payloadMap.get("mfa.methods");

	// Step 2: For each key absent from payload, read persisted value from DB
	let requireMfa: string;
	if (submittedRequire !== undefined) {
		requireMfa = submittedRequire;
	} else {
		requireMfa = await getSettingOrDefault("mfa.require_mfa", "false");
	}

	let methodsRaw: string | null;
	if (submittedMethods !== undefined) {
		methodsRaw = submittedMethods;
	} else {
		methodsRaw = await getSettingOrDefault("mfa.methods", "");
	}

	// Step 3: Evaluate merged resulting state
	const requiresEnforcement = requireMfa === "true";
	const enabledMethods = parseMfaMethods(methodsRaw);

	if (requiresEnforcement && enabledMethods.length === 0) {
		return NextResponse.json(
			{
				code: "mfa_no_methods_enabled",
				error: "MFA cannot be required when no MFA methods are enabled.",
			},
			{ status: 400 },
		);
	}

	return null;
}

/**
 * POST /api/settings/batch
 * Atomically write multiple settings in a single Postgres transaction.
 * Body: Array of { key: string, value: string, encrypted?: boolean, category?: string }
 *
 * Protected by middleware — requires admin role (ADMIN_PREFIXES includes /api/settings/batch).
 */
export async function POST(request: Request) {
	try {
		const body = await request.json();

		if (!Array.isArray(body)) {
			return NextResponse.json({ error: "Request body must be an array of settings entries" }, { status: 400 });
		}

		if (body.length === 0) {
			return NextResponse.json({ success: true, count: 0 });
		}

		if (body.length > MAX_BATCH_SIZE) {
			return NextResponse.json({ error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} entries` }, { status: 400 });
		}

		// Validate each entry
		for (let i = 0; i < body.length; i++) {
			const entry = body[i];

			if (!entry || typeof entry !== "object") {
				return NextResponse.json({ error: `Entry at index ${i} must be an object` }, { status: 400 });
			}

			if (!entry.key || typeof entry.key !== "string") {
				return NextResponse.json({ error: `Entry at index ${i}: key is required and must be a string` }, { status: 400 });
			}

			if (entry.value === undefined || entry.value === null) {
				return NextResponse.json({ error: `Entry at index ${i}: value is required` }, { status: 400 });
			}

			if (entry.encrypted === true && String(entry.value) === "") {
				return NextResponse.json({ error: `Entry at index ${i}: encrypted entries must have a non-empty value` }, { status: 400 });
			}
		}

		const entries = body.map((entry) => ({
			key: String(entry.key),
			value: String(entry.value),
			encrypted: entry.encrypted === true,
			category: typeof entry.category === "string" ? entry.category : "general",
		}));

		// Guard C (SR-MFA-1): build a payload map for the invariant check
		const payloadMap = new Map<string, string>(entries.map((e) => [e.key, e.value]));
		const guardResponse = await checkMfaInvariant(payloadMap);
		if (guardResponse) return guardResponse;

		await batchSetSettings(entries, SETTINGS_TABLE);

		return NextResponse.json({ success: true, count: entries.length });
	} catch (error) {
		console.error("Failed to batch save settings:", error);
		return NextResponse.json({ error: "Failed to batch save settings" }, { status: 500 });
	}
}
