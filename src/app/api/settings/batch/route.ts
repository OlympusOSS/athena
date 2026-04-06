import { batchSetSettings } from "@olympusoss/sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SETTINGS_TABLE = process.env.SETTINGS_TABLE || "ciam_settings";

// Guard: max 20 entries per batch (SDK comment in batchSetSettings notes this limit).
const MAX_BATCH_SIZE = 20;

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

		await batchSetSettings(entries, SETTINGS_TABLE);

		return NextResponse.json({ success: true, count: entries.length });
	} catch (error) {
		console.error("Failed to batch save settings:", error);
		return NextResponse.json({ error: "Failed to batch save settings" }, { status: 500 });
	}
}
