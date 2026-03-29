import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface VersionResult {
	latest: string | null;
	error?: string;
}

/**
 * Fetches the latest release version from GitHub Releases.
 * Uses the public API — no authentication required for public repos.
 */
async function fetchLatestRelease(repo: string): Promise<VersionResult> {
	try {
		const res = await fetch(`https://api.github.com/repos/OlympusOSS/${repo}/releases/latest`, {
			headers: { Accept: "application/vnd.github.v3+json" },
			signal: AbortSignal.timeout(5000),
		});
		if (!res.ok) {
			return { latest: null, error: `GitHub API returned ${res.status}` };
		}
		const release = await res.json();
		const tag = (release.tag_name || "").replace(/^v/, "");
		return { latest: tag || null };
	} catch (error: any) {
		return { latest: null, error: error.message || "Failed to fetch latest release" };
	}
}

export async function GET() {
	const [athena, hera] = await Promise.all([fetchLatestRelease("athena"), fetchLatestRelease("hera")]);

	return NextResponse.json({ athena, hera });
}
