import { create } from "zustand";
import type { Session } from "@ory/kratos-client";
import { type AuthUser, UserRole } from "../types";
import { sessionToAuthUser } from "../utils";
import { getIamKratosFrontendApi } from "@/services/iam-kratos";

// Define auth store interface
interface AuthStoreState {
	user: AuthUser | null;
	session: Session | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	error: string | null;

	// Actions
	checkSession: () => Promise<void>;
	login: (flowId: string, csrfToken: string, email: string, password: string) => Promise<boolean>;
	logout: () => Promise<void>;
	hasPermission: (requiredRole: UserRole) => boolean;
	setLoading: (isLoading: boolean) => void;
	clearError: () => void;
}

// Create auth store (no persistence - session state comes from Kratos cookies)
export const useAuthStore = create<AuthStoreState>()((set, get) => ({
	user: null,
	session: null,
	isAuthenticated: false,
	isLoading: true,
	error: null,

	setLoading: (isLoading: boolean) => set({ isLoading }),
	clearError: () => set({ error: null }),

	checkSession: async () => {
		try {
			const api = getIamKratosFrontendApi();
			const { data: session } = await api.toSession();
			const user = sessionToAuthUser(session);
			set({
				user,
				session,
				isAuthenticated: true,
				isLoading: false,
				error: null,
			});
		} catch {
			set({
				user: null,
				session: null,
				isAuthenticated: false,
				isLoading: false,
			});
		}
	},

	login: async (flowId: string, csrfToken: string, email: string, password: string) => {
		try {
			const api = getIamKratosFrontendApi();
			await api.updateLoginFlow({
				flow: flowId,
				updateLoginFlowBody: {
					method: "password",
					identifier: email,
					password,
					csrf_token: csrfToken,
				},
			});

			// After successful login, check session to populate user
			await get().checkSession();
			return true;
		} catch (error: unknown) {
			// Kratos returns 400 with flow data on validation errors
			const err = error as { response?: { data?: { ui?: { messages?: Array<{ text?: string }> } } } };
			const message = err?.response?.data?.ui?.messages?.[0]?.text || "Invalid email or password";
			set({ error: message });
			return false;
		}
	},

	logout: async () => {
		try {
			const api = getIamKratosFrontendApi();
			const { data } = await api.createBrowserLogoutFlow();
			if (data.logout_url) {
				// The logout_url points directly to iam-kratos (e.g., http://localhost:7000/...)
				// Rewrite it to go through the proxy so the browser stays on localhost:3001
				const logoutUrl = new URL(data.logout_url);
				const proxyLogoutUrl = `/api/iam-kratos${logoutUrl.pathname}${logoutUrl.search}`;

				set({
					user: null,
					session: null,
					isAuthenticated: false,
				});

				// Execute logout through proxy, then redirect to login
				try {
					await fetch(proxyLogoutUrl, { credentials: "include", redirect: "manual" });
				} catch {
					// Logout request may fail if Kratos redirects, but session cookie is cleared
				}
				window.location.href = "/login";
			}
		} catch {
			// If logout fails (e.g., no session), just clear local state and redirect
			set({
				user: null,
				session: null,
				isAuthenticated: false,
			});
			window.location.href = "/login";
		}
	},

	hasPermission: (requiredRole: UserRole) => {
		const { user } = get();
		if (!user) return false;

		// Admin can access everything
		if (user.role === UserRole.ADMIN) return true;

		// Check if user has the required role
		return user.role === requiredRole;
	},
}));

// Hooks for easier access to auth store
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useIsAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useLogin = () => useAuthStore((state) => state.login);
export const useLogout = () => useAuthStore((state) => state.logout);
export const useHasPermission = () => useAuthStore((state) => state.hasPermission);
export const useCheckSession = () => useAuthStore((state) => state.checkSession);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useClearError = () => useAuthStore((state) => state.clearError);

// Re-export types for easier access
export type { AuthUser } from "../types";
export { UserRole } from "../types";
