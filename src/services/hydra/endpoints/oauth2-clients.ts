import type { OAuth2Client } from "@ory/hydra-client";
import { withApiErrorHandling } from "@/utils/api-wrapper";
import { getAdminOAuth2Api } from "../client";
import type { PaginationParams } from "../types";

// OAuth2 Client CRUD operations

export interface ListOAuth2ClientsParams extends PaginationParams {
	client_name?: string;
	owner?: string;
}

export interface CreateOAuth2ClientRequest {
	client_id?: string;
	client_name?: string;
	client_secret?: string;
	client_uri?: string;
	contacts?: string[];
	grant_types?: string[];
	response_types?: string[];
	redirect_uris?: string[];
	post_logout_redirect_uris?: string[];
	scope?: string;
	audience?: string[];
	owner?: string;
	policy_uri?: string;
	tos_uri?: string;
	client_secret_expires_at?: number;
	logo_uri?: string;
	[key: string]: any;
}

export interface UpdateOAuth2ClientRequest extends CreateOAuth2ClientRequest {
	client_id: string;
}

// List OAuth2 clients with pagination
export async function listOAuth2Clients(params: ListOAuth2ClientsParams = {}) {
	return withApiErrorHandling(async () => {
		const response = await getAdminOAuth2Api().listOAuth2Clients({
			pageSize: params.page_size,
			pageToken: params.page_token,
			clientName: params.client_name,
			owner: params.owner,
		});

		return {
			data: response.data || [],
		};
	}, "Hydra");
}

// Get a specific OAuth2 client
export async function getOAuth2Client(clientId: string) {
	return withApiErrorHandling(async () => {
		const response = await getAdminOAuth2Api().getOAuth2Client({
			id: clientId,
		});
		return { data: response.data };
	}, "Hydra");
}

// Create a new OAuth2 client
export async function createOAuth2Client(clientData: CreateOAuth2ClientRequest) {
	return withApiErrorHandling(async () => {
		const response = await getAdminOAuth2Api().createOAuth2Client({
			oAuth2Client: clientData,
		});
		return { data: response.data };
	}, "Hydra");
}

// Update an existing OAuth2 client
export async function updateOAuth2Client(clientId: string, clientData: UpdateOAuth2ClientRequest) {
	return withApiErrorHandling(async () => {
		const response = await getAdminOAuth2Api().setOAuth2Client({
			id: clientId,
			oAuth2Client: clientData,
		});
		return { data: response.data };
	}, "Hydra");
}

// Patch an existing OAuth2 client (partial update)
export async function patchOAuth2Client(clientId: string, clientData: Partial<CreateOAuth2ClientRequest>) {
	return withApiErrorHandling(async () => {
		const response = await getAdminOAuth2Api().patchOAuth2Client({
			id: clientId,
			jsonPatch: Object.entries(clientData).map(([key, value]) => ({
				op: "replace",
				path: `/${key}`,
				value,
			})),
		});
		return { data: response.data };
	}, "Hydra");
}

/**
 * Rotate the client secret for an existing OAuth2 client.
 *
 * SECURITY: This is the only correct rotation mechanism for the deployed @ory/hydra-client
 * version. No `rotateOAuth2ClientSecret` method or `/lifesign` endpoint exists.
 * The correct approach is a full PUT with a newly generated server-side secret.
 *
 * Flow:
 *   1. GET the current client record from Hydra (to preserve all existing fields)
 *   2. Caller provides a pre-generated server-side secret (generated in the API route
 *      to keep `node:crypto` out of this file's webpack bundle trace)
 *   3. PUT the full client record back with the new secret
 *   4. Return `{ client_id, client_secret }` — Hydra echoes the plaintext in the PUT
 *      response body (verified via OQ-3, athena#50 thread 2026-04-02)
 *
 * The previous secret is immediately invalidated after a successful PUT — any token
 * request using the old secret will return 401.
 *
 * @param clientId - the Hydra client ID to rotate
 * @param newSecret - caller-provided cryptographically random secret (e.g. 32-byte hex)
 */
export async function rotateOAuth2ClientSecret(clientId: string, newSecret: string): Promise<{ client_id: string; client_secret: string }> {
	return withApiErrorHandling(async () => {
		// Step 1: Fetch the current full client record
		const getResponse = await getAdminOAuth2Api().getOAuth2Client({ id: clientId });
		const currentClient = getResponse.data;

		// Step 2: PUT the full record back with the provided new secret
		const putResponse = await getAdminOAuth2Api().setOAuth2Client({
			id: clientId,
			oAuth2Client: {
				...currentClient,
				client_secret: newSecret,
			},
		});

		// Step 3: Return the plaintext secret from the PUT response.
		// Per OQ-3 verification (athena#50 thread): Hydra echoes the plaintext in the PUT
		// response body. Return response.data.client_secret (what Hydra echoes), not the
		// locally generated value, in case Hydra processes or re-encodes the value.
		const rotatedSecret = putResponse.data.client_secret;

		if (typeof rotatedSecret !== "string" || rotatedSecret.length === 0) {
			throw new Error("Hydra did not return a client_secret in the PUT response — rotation failed");
		}

		return {
			client_id: putResponse.data.client_id ?? clientId,
			client_secret: rotatedSecret,
		};
	}, "Hydra");
}

// Delete an OAuth2 client
export async function deleteOAuth2Client(clientId: string) {
	return withApiErrorHandling(async () => {
		const response = await getAdminOAuth2Api().deleteOAuth2Client({
			id: clientId,
		});
		return { data: response.data };
	}, "Hydra");
}

// Get all OAuth2 clients with automatic pagination handling
export async function getAllOAuth2Clients(options?: {
	maxPages?: number;
	pageSize?: number;
	onProgress?: (currentCount: number, pageNumber: number) => void;
}) {
	const { maxPages = 20, pageSize = 250, onProgress } = options || {};

	let allClients: OAuth2Client[] = [];
	let pageToken: string | undefined;
	let pageNumber = 1;

	do {
		const response = await listOAuth2Clients({
			page_size: pageSize,
			page_token: pageToken,
		});

		const clients = response.data || [];
		allClients = [...allClients, ...clients];

		// Extract next page token (this would need to be implemented based on actual API response)
		pageToken = undefined;

		if (onProgress) {
			onProgress(allClients.length, pageNumber);
		}

		pageNumber++;

		// Stop if we have no more data or reached max pages
		if (!pageToken || clients.length < pageSize || pageNumber > maxPages) {
			break;
		}
	} while (pageToken);

	return {
		clients: allClients,
		totalCount: allClients.length,
		isComplete: !pageToken,
		pagesFetched: pageNumber - 1,
	};
}
