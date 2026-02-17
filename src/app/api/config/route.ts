import { NextResponse } from "next/server";
import { encryptApiKey } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET() {
	// Get API keys from env and encrypt them
	const kratosApiKey = process.env.KRATOS_API_KEY || process.env.ORY_API_KEY || "";
	const hydraApiKey = process.env.HYDRA_API_KEY || process.env.ORY_API_KEY || "";

	// HYDRA_ENABLED defaults to true for backwards compatibility
	// Set to "false" to disable Hydra integration
	const hydraEnabled = process.env.HYDRA_ENABLED !== "false";

	const config = {
		kratosPublicUrl: process.env.KRATOS_PUBLIC_URL || "http://localhost:5000",
		kratosAdminUrl: process.env.KRATOS_ADMIN_URL || "http://localhost:5001",
		kratosApiKey: encryptApiKey(kratosApiKey),
		hydraPublicUrl: process.env.HYDRA_PUBLIC_URL || "http://localhost:5002",
		hydraAdminUrl: process.env.HYDRA_ADMIN_URL || "http://localhost:5003",
		hydraApiKey: encryptApiKey(hydraApiKey),
		isOryNetwork: process.env.IS_ORY_NETWORK === "true",
		hydraEnabled,
	};

	return NextResponse.json(config);
}
