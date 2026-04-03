import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LockedAccount, LockedAccountsResponse } from "../types";

const QUERY_KEY = ["security", "locked-accounts"] as const;

async function fetchLockedAccounts(): Promise<LockedAccountsResponse> {
	const response = await fetch("/api/security/locked-accounts");

	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.error || `Failed to fetch locked accounts (${response.status})`);
	}

	return response.json();
}

async function postUnlockAccount(identifier: string): Promise<void> {
	const response = await fetch("/api/security/locked-accounts/unlock", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ identifier }),
	});

	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.error || `Failed to unlock account (${response.status})`);
	}
}

/**
 * Fetches all active locked accounts.
 */
export function useLockedAccounts() {
	return useQuery<LockedAccountsResponse, Error>({
		queryKey: QUERY_KEY,
		queryFn: fetchLockedAccounts,
		staleTime: 30_000, // 30 seconds
		refetchOnWindowFocus: false,
	});
}

/**
 * Mutation to manually unlock an account by identifier.
 * On success, the locked-accounts list is invalidated and re-fetched.
 */
export function useUnlockAccount() {
	const queryClient = useQueryClient();

	return useMutation<void, Error, LockedAccount["identifier"]>({
		mutationFn: (identifier) => postUnlockAccount(identifier),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QUERY_KEY });
		},
	});
}
