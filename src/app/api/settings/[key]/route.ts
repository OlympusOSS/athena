import { NextResponse } from "next/server";
import {
	getSetting,
	getSecretSetting,
	deleteSetting,
} from "@olympusoss/sdk";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/:key?decrypt=true
 * Get a single setting by key.
 * Pass ?decrypt=true to decrypt an encrypted value (for server-side use).
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ key: string }> },
) {
	try {
		const { key } = await params;
		const { searchParams } = new URL(request.url);
		const shouldDecrypt = searchParams.get("decrypt") === "true";

		const value = shouldDecrypt
			? await getSecretSetting(key)
			: await getSetting(key);

		if (value === null) {
			return NextResponse.json(
				{ error: "Setting not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json({ key, value });
	} catch (error) {
		console.error("Failed to get setting:", error);
		return NextResponse.json(
			{ error: "Failed to get setting" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/settings/:key
 * Delete a setting by key.
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ key: string }> },
) {
	try {
		const { key } = await params;

		await deleteSetting(key);
		return NextResponse.json({ success: true, key });
	} catch (error) {
		console.error("Failed to delete setting:", error);
		return NextResponse.json(
			{ error: "Failed to delete setting" },
			{ status: 500 },
		);
	}
}
