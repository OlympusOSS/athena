import { FrontendApi } from "@ory/kratos-client";
import { getIamKratosPublicConfiguration } from "./config";

let frontendApiInstance: FrontendApi | null = null;

/**
 * Get the IAM Kratos Frontend API client for authentication flows.
 * Uses the public configuration (proxy path on client, env var on server).
 */
export function getIamKratosFrontendApi(): FrontendApi {
	if (!frontendApiInstance) {
		frontendApiInstance = new FrontendApi(getIamKratosPublicConfiguration());
	}
	return frontendApiInstance;
}

/**
 * Reset the cached API client instance.
 * Useful when configuration changes at runtime.
 */
export function resetIamKratosClient(): void {
	frontendApiInstance = null;
}
