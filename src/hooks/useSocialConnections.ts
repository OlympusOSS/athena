/**
 * TanStack Query hooks for Social Connections admin panel (athena#49).
 *
 * All server state for social connection management goes through these hooks.
 * No raw fetch() in page or component files.
 *
 * Error handling follows the athena#60 error shape: { error: string, code?: number }
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReloadStatus } from "@/lib/social-connections/reload-client";
import type { SocialConnectionAdminView } from "@/lib/social-connections/serializers";

const QUERY_KEY = ["social-connections"] as const;

// --- Response types ---

export interface SocialConnectionsResponse {
	connections: SocialConnectionAdminView[];
}

export interface SaveConnectionPayload {
	provider: string;
	client_id: string;
	client_secret?: string;
	scopes?: string[];
	enabled: boolean;
}

export interface SaveConnectionResponse {
	success: boolean;
	provider: string;
	secretChanged: boolean;
	reloadStatus: ReloadStatus;
}

export interface ToggleConnectionPayload {
	provider: string;
	enabled: boolean;
}

export interface ToggleConnectionResponse {
	success: boolean;
	provider: string;
	enabled: boolean;
	reloadStatus: ReloadStatus;
}

export interface DeleteConnectionResponse {
	success: boolean;
	provider: string;
	reloadStatus: ReloadStatus;
}

// --- Fetch functions ---

async function fetchSocialConnections(): Promise<SocialConnectionsResponse> {
	const response = await fetch("/api/connections/social");

	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.error || `Failed to fetch social connections (${response.status})`);
	}

	return response.json();
}

async function postSocialConnection(payload: SaveConnectionPayload): Promise<SaveConnectionResponse> {
	const response = await fetch("/api/connections/social", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.error || `Failed to save social connection (${response.status})`);
	}

	return response.json();
}

async function patchSocialConnection(payload: ToggleConnectionPayload): Promise<ToggleConnectionResponse> {
	const { provider, enabled } = payload;
	const response = await fetch(`/api/connections/social/${encodeURIComponent(provider)}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ enabled }),
	});

	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.error || `Failed to toggle social connection (${response.status})`);
	}

	return response.json();
}

async function deleteSocialConnectionFetch(provider: string): Promise<DeleteConnectionResponse> {
	const response = await fetch(`/api/connections/social/${encodeURIComponent(provider)}`, {
		method: "DELETE",
	});

	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.error || `Failed to delete social connection (${response.status})`);
	}

	return response.json();
}

// --- Hooks ---

/**
 * Fetches all configured social connections for the admin panel.
 */
export function useSocialConnections() {
	return useQuery<SocialConnectionsResponse, Error>({
		queryKey: QUERY_KEY,
		queryFn: fetchSocialConnections,
		staleTime: 30_000, // 30 seconds
		refetchOnWindowFocus: false,
	});
}

/**
 * Creates or updates a social connection.
 * Invalidates the connections list on success.
 */
export function useCreateSocialConnection() {
	const queryClient = useQueryClient();

	return useMutation<SaveConnectionResponse, Error, SaveConnectionPayload>({
		mutationFn: postSocialConnection,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QUERY_KEY });
		},
	});
}

/**
 * Toggles the enabled/disabled state of a social connection.
 * Invalidates the connections list on success.
 */
export function useToggleSocialConnection() {
	const queryClient = useQueryClient();

	return useMutation<ToggleConnectionResponse, Error, ToggleConnectionPayload>({
		mutationFn: patchSocialConnection,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QUERY_KEY });
		},
	});
}

/**
 * Deletes a social connection.
 * Invalidates the connections list on success.
 */
export function useDeleteSocialConnection() {
	const queryClient = useQueryClient();

	return useMutation<DeleteConnectionResponse, Error, string>({
		mutationFn: deleteSocialConnectionFetch,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QUERY_KEY });
		},
	});
}
