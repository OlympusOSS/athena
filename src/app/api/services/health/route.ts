import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function checkService(url: string | undefined, healthPath: string): Promise<{ isHealthy: boolean; version: string | null; error?: string }> {
	if (!url) {
		return { isHealthy: false, version: null, error: "Not configured" };
	}
	try {
		const res = await fetch(`${url}${healthPath}`, {
			signal: AbortSignal.timeout(5000),
		});
		const data = await res.json();
		return { isHealthy: true, version: data.version || null };
	} catch (error: any) {
		return {
			isHealthy: false,
			version: null,
			error: error.message || "Unable to connect",
		};
	}
}

export async function GET() {
	const [ciamAthena, iamAthena, ciamHera, iamHera] = await Promise.all([
		checkService(process.env.CIAM_ATHENA_INTERNAL_URL, "/api/health"),
		checkService(process.env.IAM_ATHENA_INTERNAL_URL, "/api/health"),
		checkService(process.env.CIAM_HERA_INTERNAL_URL, "/health"),
		checkService(process.env.IAM_HERA_INTERNAL_URL, "/health"),
	]);

	return NextResponse.json({ ciamAthena, iamAthena, ciamHera, iamHera });
}
