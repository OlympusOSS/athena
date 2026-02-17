import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type AuthUser, UserRole } from "../types";

const IAM_KRATOS_BASE = "/api/iam-kratos";

// Define auth store interface
interface AuthStoreState {
	user: AuthUser | null;
	sessionToken: string | null;
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

// Helper: map Kratos identity to AuthUser
function identityToAuthUser(identity: Record<string, unknown>): AuthUser {
	const traits = identity.traits as {
		email?: string;
		name?: { first?: string; last?: string };
		role?: string;
	};

	const email = traits?.email || "";
	const firstName = traits?.name?.first || "";
	const lastName = traits?.name?.last || "";
	const displayName = [firstName, lastName].filter(Boolean).join(" ") || email;
	const role = traits?.role === "admin" ? UserRole.ADMIN : UserRole.VIEWER;

	return {
		kratosIdentityId: identity.id as string,
		email,
		role,
		displayName,
	};
}

// Create auth store with persistence for session token
export const useAuthStore = create<AuthStoreState>()(
	persist(
		(set, get) => ({
			user: null,
			sessionToken: null,
			isAuthenticated: false,
			isLoading: true,
			error: null,

			setLoading: (isLoading: boolean) => set({ isLoading }),
			clearError: () => set({ error: null }),

			checkSession: async () => {
				// Check if login is disabled (for testing/screenshots)
				const disableLogin = process.env.NEXT_PUBLIC_DISABLE_LOGIN === "true";
				if (disableLogin) {
					set({
						user: {
							kratosIdentityId: "test-admin",
							email: "admin@test.local",
							role: UserRole.ADMIN,
							displayName: "Test Admin",
						},
						isAuthenticated: true,
						isLoading: false,
					});
					return;
				}

				const { sessionToken } = get();
				if (!sessionToken) {
					set({ user: null, isAuthenticated: false, isLoading: false });
					return;
				}

				try {
					const res = await fetch(`${IAM_KRATOS_BASE}/sessions/whoami`, {
						headers: { "X-Session-Token": sessionToken },
					});

					if (!res.ok) {
						set({ user: null, sessionToken: null, isAuthenticated: false, isLoading: false });
						return;
					}

					const session = await res.json();
					const user = identityToAuthUser(session.identity);
					set({
						user,
						isAuthenticated: true,
						isLoading: false,
						error: null,
					});
				} catch {
					set({
						user: null,
						sessionToken: null,
						isAuthenticated: false,
						isLoading: false,
					});
				}
			},

			login: async (flowId: string, csrfToken: string, email: string, password: string) => {
				try {
					// Kratos v25 API flows require form-urlencoded, not JSON
					const params = new URLSearchParams();
					params.set("method", "password");
					params.set("identifier", email);
					params.set("password", password);
					if (csrfToken) {
						params.set("csrf_token", csrfToken);
					}

					const res = await fetch(`${IAM_KRATOS_BASE}/self-service/login?flow=${flowId}`, {
						method: "POST",
						headers: { "Content-Type": "application/x-www-form-urlencoded" },
						body: params.toString(),
					});

					if (!res.ok) {
						const data = await res.json().catch(() => ({}));
						const msg =
							data?.ui?.messages?.[0]?.text || data?.error?.message || "Invalid email or password";
						set({ error: msg });
						return false;
					}

					const data = await res.json();
					const sessionToken = data.session_token;
					const user = identityToAuthUser(data.session?.identity);

					set({
						user,
						sessionToken,
						isAuthenticated: true,
						isLoading: false,
						error: null,
					});
					return true;
				} catch (error) {
					console.error("Login error:", error);
					set({ error: "An error occurred during login" });
					return false;
				}
			},

			logout: async () => {
				const { sessionToken } = get();

				if (sessionToken) {
					try {
						// Revoke the session token
						await fetch(`${IAM_KRATOS_BASE}/self-service/logout/api`, {
							method: "DELETE",
							headers: {
								"Content-Type": "application/json",
								"X-Session-Token": sessionToken,
							},
							body: JSON.stringify({ session_token: sessionToken }),
						});
					} catch (error) {
						console.error("Logout error:", error);
					}
				}

				set({
					user: null,
					sessionToken: null,
					isAuthenticated: false,
					error: null,
				});
			},

			hasPermission: (requiredRole: UserRole) => {
				const { user } = get();

				if (!user) return false;

				// Admin can access everything
				if (user.role === UserRole.ADMIN) return true;

				// Check if user has the required role
				return user.role === requiredRole;
			},
		}),
		{
			name: "athena-auth",
			partialize: (state) => ({
				sessionToken: state.sessionToken,
				user: state.user,
				isAuthenticated: state.isAuthenticated,
			}),
			onRehydrateStorage: () => (state) => {
				// After rehydration, verify the session is still valid
				if (state && state.sessionToken) {
					// Don't set loading to false yet — checkSession will do that
					state.checkSession();
				} else if (state) {
					state.setLoading(false);
				}
			},
		},
	),
);

// Hooks for easier access to auth store
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useIsAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useLogin = () => useAuthStore((state) => state.login);
export const useLogout = () => useAuthStore((state) => state.logout);
export const useHasPermission = () => useAuthStore((state) => state.hasPermission);
export const useCheckSession = () => useAuthStore((state) => state.checkSession);
export const useClearError = () => useAuthStore((state) => state.clearError);
export const useAuthError = () => useAuthStore((state) => state.error);

// Re-export types for easier access
export type { AuthUser } from "../types";
export { UserRole } from "../types";
