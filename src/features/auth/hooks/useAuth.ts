import { create } from "zustand";
import { type AuthUser, UserRole } from "../types";

// Define auth store interface
interface AuthStoreState {
	user: AuthUser | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	error: string | null;

	// Actions
	checkSession: () => Promise<void>;
	login: () => void;
	logout: () => void;
	hasPermission: (requiredRole: UserRole) => boolean;
	setLoading: (isLoading: boolean) => void;
	clearError: () => void;
}

// Auth store — session is managed server-side via httpOnly cookies (OAuth2/OIDC)
export const useAuthStore = create<AuthStoreState>()((set, get) => ({
	user: null,
	isAuthenticated: false,
	isLoading: true,
	error: null,

	setLoading: (isLoading: boolean) => set({ isLoading }),
	clearError: () => set({ error: null }),

	checkSession: async () => {
		try {
			const res = await fetch("/api/auth/session");

			if (!res.ok) {
				set({ user: null, isAuthenticated: false, isLoading: false });
				return;
			}

			const data = await res.json();
			const user: AuthUser = {
				kratosIdentityId: data.user.kratosIdentityId || "",
				email: data.user.email || "",
				role: data.user.role === "admin" ? UserRole.ADMIN : UserRole.VIEWER,
				displayName: data.user.displayName || data.user.email || "",
			};

			set({
				user,
				isAuthenticated: true,
				isLoading: false,
				error: null,
			});
		} catch {
			set({
				user: null,
				isAuthenticated: false,
				isLoading: false,
			});
		}
	},

	login: () => {
		// Redirect to OAuth2 login flow via IAM Hydra → IAM Hera
		window.location.href = "/api/auth/login";
	},

	logout: () => {
		// Navigate to the logout endpoint FIRST, without clearing Zustand state.
		// Clearing isAuthenticated here would trigger AuthProvider's useEffect to
		// redirect to /api/auth/login — racing with this navigation and potentially
		// overwriting it, causing the logout route to never be hit.
		// The logout endpoint will delete the httpOnly cookie and revoke sessions,
		// then redirect to the login flow where checkSession() will naturally reset state.
		window.location.href = "/api/auth/logout";
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
export const useClearError = () => useAuthStore((state) => state.clearError);
export const useAuthError = () => useAuthStore((state) => state.error);

// Re-export types for easier access
export type { AuthUser } from "../types";
export { UserRole } from "../types";
