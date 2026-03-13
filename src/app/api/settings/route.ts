import { NextResponse } from "next/server";
import {
	listSettingsForDisplay,
	setSetting,
} from "@olympusoss/sdk";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings?category=captcha
 * Lists all settings (encrypted values masked for display).
 */
export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const category = searchParams.get("category") || undefined;

		const settings = await listSettingsForDisplay(category);
		return NextResponse.json({ settings });
	} catch (error) {
		console.error("Failed to list settings:", error);
		return NextResponse.json(
			{ error: "Failed to list settings" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/settings
 * Create or update a setting.
 * Body: { key: string, value: string, encrypted?: boolean, category?: string }
 */
export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { key, value, encrypted, category } = body;

		if (!key || typeof key !== "string") {
			return NextResponse.json(
				{ error: "key is required and must be a string" },
				{ status: 400 },
			);
		}

		if (value === undefined || value === null) {
			return NextResponse.json(
				{ error: "value is required" },
				{ status: 400 },
			);
		}

		await setSetting(key, String(value), {
			encrypted: encrypted === true,
			category: category || "general",
		});

		return NextResponse.json({ success: true, key });
	} catch (error) {
		console.error("Failed to save setting:", error);
		return NextResponse.json(
			{ error: "Failed to save setting" },
			{ status: 500 },
		);
	}
}
