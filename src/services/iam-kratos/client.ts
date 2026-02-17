import { Configuration, FrontendApi } from "@ory/kratos-client";

const isClient = typeof window !== "undefined";

function getIamKratosPublicUrl(): string {
	if (isClient) {
		// Client-side: use the proxy path (handled by Next.js middleware)
		return "/api/iam-kratos";
	}
	// Server-side: use the direct URL
	return process.env.IAM_KRATOS_PUBLIC_URL || "http://localhost:7000";
}

// Singleton FrontendApi instance
let frontendApiInstance: FrontendApi | null = null;

export const getIamKratosFrontendApi = (): FrontendApi => {
	if (!frontendApiInstance) {
		const config = new Configuration({
			basePath: getIamKratosPublicUrl(),
			baseOptions: {
				withCredentials: true,
			},
		});
		frontendApiInstance = new FrontendApi(config);
	}
	return frontendApiInstance;
};

// Reset function for testing or configuration changes
export const resetIamKratosClient = (): void => {
	frontendApiInstance = null;
};
