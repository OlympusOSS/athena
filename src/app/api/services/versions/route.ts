import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface GHCRVersionResult {
	latest: string | null;
	error?: string;
}

/**
 * Fetches the latest semver tag from GHCR for a given package.
 * Uses OCI anonymous token exchange for public packages.
 */
async function fetchLatestGHCRVersion(image: string): Promise<GHCRVersionResult> {
	try {
		// 1. Get anonymous token for the package
		const tokenRes = await fetch(`https://ghcr.io/token?scope=repository:${image}:pull`, {
			signal: AbortSignal.timeout(5000),
		});
		if (!tokenRes.ok) {
			return { latest: null, error: `Token exchange failed: ${tokenRes.status}` };
		}
		const { token } = await tokenRes.json();

		// 2. List tags via OCI distribution API
		const tagsRes = await fetch(`https://ghcr.io/v2/${image}/tags/list?n=1000`, {
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(5000),
		});
		if (!tagsRes.ok) {
			return { latest: null, error: `Tags list failed: ${tagsRes.status}` };
		}
		const { tags } = await tagsRes.json();

		// 3. Filter for semver tags (v1.0.0 pattern) and find latest
		const semverTags = (tags as string[])
			.filter((t) => /^v?\d+\.\d+\.\d+$/.test(t))
			.map((t) => t.replace(/^v/, ""))
			.sort((a, b) => {
				const pa = a.split(".").map(Number);
				const pb = b.split(".").map(Number);
				for (let i = 0; i < 3; i++) {
					if (pa[i] !== pb[i]) return pb[i] - pa[i];
				}
				return 0;
			});

		return { latest: semverTags[0] || null };
	} catch (error: any) {
		return { latest: null, error: error.message || "Failed to fetch GHCR version" };
	}
}

export async function GET() {
	const [athena, hera] = await Promise.all([fetchLatestGHCRVersion("olympusoss/athena"), fetchLatestGHCRVersion("olympusoss/hera")]);

	return NextResponse.json({ athena, hera });
}
