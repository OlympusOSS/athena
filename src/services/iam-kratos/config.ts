import { Configuration } from "@ory/kratos-client";

/**
 * IAM Kratos configuration for admin authentication.
 *
 * Server-side: uses IAM_KRATOS_PUBLIC_URL env var (Docker internal hostname).
 * Client-side: uses /api/iam-kratos proxy path (handled by Next.js middleware).
 */

function getIamKratosPublicUrl(): string {
	// Client-side: always use the proxy path
	if (typeof window !== "undefined") {
		return "/api/iam-kratos";
	}

	// Server-side: use env var or fallback to localhost
	return process.env.IAM_KRATOS_PUBLIC_URL || "http://localhost:4100";
}

export function getIamKratosPublicConfiguration(): Configuration {
	return new Configuration({
		basePath: getIamKratosPublicUrl(),
	});
}
