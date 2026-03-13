import type {
	DeleteIdentityCredentialsTypeEnum,
	IdentityApiCreateIdentityRequest,
	IdentityApiCreateRecoveryLinkForIdentityRequest,
	IdentityApiDeleteIdentityRequest,
	IdentityApiGetIdentityRequest,
	IdentityApiListIdentitiesRequest,
	IdentityApiPatchIdentityRequest,
} from "@ory/kratos-client";

export type { DeleteIdentityCredentialsTypeEnum };

import { fetchAllPages } from "@/lib/pagination-utils";
import { withApiErrorHandling } from "@/utils/api-wrapper";
import { getAdminApi } from "../client";

// Identity CRUD operations
export async function listIdentities(params: IdentityApiListIdentitiesRequest = {}) {
	return withApiErrorHandling(async () => {
		const adminApi = getAdminApi();
		return await adminApi.listIdentities(params);
	}, "Kratos");
}

export async function getIdentity(params: IdentityApiGetIdentityRequest) {
	return withApiErrorHandling(async () => {
		const adminApi = getAdminApi();
		return await adminApi.getIdentity(params);
	}, "Kratos");
}

export async function createIdentity(params: IdentityApiCreateIdentityRequest) {
	return withApiErrorHandling(async () => {
		const adminApi = getAdminApi();
		return await adminApi.createIdentity(params);
	}, "Kratos");
}

export async function patchIdentity(params: IdentityApiPatchIdentityRequest) {
	return withApiErrorHandling(async () => {
		const adminApi = getAdminApi();
		return await adminApi.patchIdentity(params);
	}, "Kratos");
}

export async function deleteIdentity(params: IdentityApiDeleteIdentityRequest) {
	return withApiErrorHandling(async () => {
		const adminApi = getAdminApi();
		return await adminApi.deleteIdentity(params);
	}, "Kratos");
}

export async function deleteIdentityCredentials(params: { id: string; type: DeleteIdentityCredentialsTypeEnum; identifier?: string }) {
	return withApiErrorHandling(async () => {
		const adminApi = getAdminApi();
		return await adminApi.deleteIdentityCredentials(params);
	}, "Kratos");
}

// Recovery operations
export async function createRecoveryLinkForIdentity(params: IdentityApiCreateRecoveryLinkForIdentityRequest) {
	return withApiErrorHandling(async () => {
		const adminApi = getAdminApi();
		return await adminApi.createRecoveryLinkForIdentity(params);
	}, "Kratos");
}

// Simplified wrapper for easier use
export async function createRecoveryLink(identityId: string) {
	return withApiErrorHandling(async () => {
		const adminApi = getAdminApi();
		return await adminApi.createRecoveryLinkForIdentity({
			createRecoveryLinkForIdentityBody: { identity_id: identityId },
		});
	}, "Kratos");
}

// Admin password reset — sets a new password on an identity via admin API
export async function updateIdentityPassword(identityId: string, newPassword: string) {
	return withApiErrorHandling(async () => {
		const adminApi = getAdminApi();

		// Fetch current identity to preserve existing data
		const { data: identity } = await adminApi.getIdentity({ id: identityId });

		// Update identity with new password credential
		return await adminApi.updateIdentity({
			id: identityId,
			updateIdentityBody: {
				schema_id: identity.schema_id,
				traits: identity.traits,
				state: identity.state as "active" | "inactive",
				metadata_public: identity.metadata_public || undefined,
				metadata_admin: identity.metadata_admin || undefined,
				credentials: {
					password: {
						config: {
							password: newPassword,
						},
					},
				},
			},
		});
	}, "Kratos");
}

// Get all identities with automatic pagination handling
export async function getAllIdentities(options?: {
	maxPages?: number;
	pageSize?: number;
	onProgress?: (currentCount: number, pageNumber: number) => void;
}) {
	const { maxPages = 20, pageSize = 250, onProgress } = options || {};

	const allIdentities = await fetchAllPages(
		async (pageToken) => {
			const requestParams: any = { pageSize };
			if (pageToken) {
				requestParams.pageToken = pageToken;
			}
			const response = await listIdentities(requestParams);
			return {
				data: response.data,
				headers: response.headers || {},
			};
		},
		{
			maxPages,
			onProgress: onProgress ? (current: number) => onProgress(current, Math.ceil(current / pageSize)) : undefined,
			stopOnError: false,
		},
	);

	return {
		identities: allIdentities,
		totalCount: allIdentities.length,
		isComplete: true,
		pagesFetched: Math.ceil(allIdentities.length / pageSize),
	};
}
