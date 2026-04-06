"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateM2MClientBody } from "@/features/oauth2-clients/constants";

// Athena HTTP client — all requests go through the same-origin Next.js API routes
// which enforce admin session via middleware.ts

export interface M2MClient {
	client_id: string;
	client_name?: string;
	scope?: string;
	grant_types?: string[];
	created_at?: string;
	updated_at?: string;
	metadata?: {
		client_type?: string;
		created_by?: string;
		token_lifetime?: number;
	};
	client_credentials_grant_access_token_lifespan?: string;
}

export interface M2MCreateResult {
	client_id: string;
	client_secret: string;
	client_name?: string;
	scope?: string;
	grant_types?: string[];
	created_at?: string;
	metadata?: Record<string, unknown>;
}

export interface M2MRotateResult {
	client_id: string;
	client_secret: string;
}

// Query keys
export const m2mClientKeys = {
	all: ["m2m-clients"] as const,
	list: () => [...m2mClientKeys.all, "list"] as const,
};

async function fetchM2MClients(): Promise<{ clients: M2MClient[] }> {
	const response = await fetch("/api/clients/m2m");
	if (!response.ok) {
		const body = await response.json().catch(() => ({ message: "Unknown error" }));
		throw new Error(body.message ?? `Failed to fetch M2M clients (${response.status})`);
	}
	return response.json();
}

async function createM2MClient(body: CreateM2MClientBody & { token_lifetime?: number }): Promise<M2MCreateResult> {
	const response = await fetch("/api/clients/m2m", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		const error = await response.json().catch(() => ({ message: "Unknown error" }));
		throw new Error(error.message ?? `Failed to create M2M client (${response.status})`);
	}
	return response.json();
}

async function rotateM2MClientSecret(clientId: string): Promise<M2MRotateResult> {
	const response = await fetch(`/api/clients/m2m/${encodeURIComponent(clientId)}/rotate-secret`, {
		method: "POST",
	});
	if (!response.ok) {
		const error = await response.json().catch(() => ({ message: "Unknown error" }));
		throw new Error(error.message ?? `Failed to rotate secret (${response.status})`);
	}
	return response.json();
}

async function deleteM2MClient(clientId: string): Promise<void> {
	const response = await fetch(`/api/clients/m2m/${encodeURIComponent(clientId)}`, {
		method: "DELETE",
	});
	if (!response.ok && response.status !== 204) {
		const error = await response.json().catch(() => ({ message: "Unknown error" }));
		throw new Error(error.message ?? `Failed to delete M2M client (${response.status})`);
	}
}

// Hook: list all M2M clients
export function useM2MClients() {
	return useQuery({
		queryKey: m2mClientKeys.list(),
		queryFn: fetchM2MClients,
		staleTime: 1000 * 60 * 5, // 5 minutes
	});
}

// Hook: create a new M2M client
// NOTE: client_secret is returned in mutation.data.client_secret — this is the ONE-TIME
// disclosure. mutation.reset() MUST be called when the SecretRevealModal closes to prevent
// stale client_secret from persisting in component state (D2 / athena#50 plan).
export function useCreateM2MClient() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (body: CreateM2MClientBody & { token_lifetime?: number }) => createM2MClient(body),
		onSuccess: () => {
			// Invalidate the list so the new client appears
			queryClient.invalidateQueries({ queryKey: m2mClientKeys.list() });
		},
	});
}

// Hook: rotate a client secret
// NOTE: client_secret is returned in mutation.data.client_secret — ONE-TIME disclosure.
// mutation.reset() MUST be called when the SecretRevealModal closes.
export function useRotateM2MSecret() {
	return useMutation({
		mutationFn: (clientId: string) => rotateM2MClientSecret(clientId),
		// No cache update — we don't cache secrets
	});
}

// Hook: delete an M2M client
export function useDeleteM2MClient() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (clientId: string) => deleteM2MClient(clientId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: m2mClientKeys.list() });
		},
	});
}

/**
 * Helper: parse token_lifetime from a Hydra lifespan string ("300s") or metadata.
 * Falls back to 3600 if not set.
 */
export function getTokenLifetimeSeconds(client: M2MClient): number {
	// Prefer metadata.token_lifetime (set by Athena at creation)
	if (client.metadata?.token_lifetime != null) {
		return client.metadata.token_lifetime;
	}
	// Fall back to parsing the Hydra lifespan string
	if (client.client_credentials_grant_access_token_lifespan) {
		const match = client.client_credentials_grant_access_token_lifespan.match(/^(\d+)s$/);
		if (match) return parseInt(match[1], 10);
	}
	return 3600;
}

/**
 * Helper: format token lifetime as human-readable string.
 */
export function formatTokenLifetime(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
	return `${Math.floor(seconds / 3600)}h`;
}
