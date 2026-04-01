import { deleteSetting, getSecretSetting, listSettings } from "@olympusoss/sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/:key?decrypt=true
 * Get a single setting by key.
 * Pass ?decrypt=true to decrypt an encrypted value (for server-side use).
 *
 * Response includes `encrypted: boolean` so callers can tell whether the
 * returned value is plaintext or ciphertext (fix for athena#58).
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
	try {
		const { key } = await params;
		const { searchParams } = new URL(request.url);
		const shouldDecrypt = searchParams.get("decrypt") === "true";

		// Fetch all settings for the category and find the matching key.
		// This gives us the full Setting row (including the `encrypted` flag)
		// without requiring a new SDK function.
		const all = await listSettings();
		const setting = all.find((s) => s.key === key);

		if (!setting) {
			return NextResponse.json({ error: "Setting not found" }, { status: 404 });
		}

		let value: string | null = setting.value;
		if (shouldDecrypt && setting.encrypted) {
			value = await getSecretSetting(key);
			if (value === null) {
				return NextResponse.json({ error: "Setting not found" }, { status: 404 });
			}
		}

		return NextResponse.json({ key, value, encrypted: setting.encrypted });
	} catch (error) {
		console.error("Failed to get setting:", error);
		return NextResponse.json({ error: "Failed to get setting" }, { status: 500 });
	}
}

/**
 * DELETE /api/settings/:key
 * Delete a setting by key.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ key: string }> }) {
	try {
		const { key } = await params;

		await deleteSetting(key);
		return NextResponse.json({ success: true, key });
	} catch (error) {
		console.error("Failed to delete setting:", error);
		return NextResponse.json({ error: "Failed to delete setting" }, { status: 500 });
	}
}
