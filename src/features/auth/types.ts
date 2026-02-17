// Define user roles
export enum UserRole {
	ADMIN = "admin",
	VIEWER = "viewer",
}

export interface AuthUser {
	kratosIdentityId: string;
	email: string;
	role: UserRole;
	displayName: string;
}

export interface AuthState {
	user: AuthUser | null;
	isAuthenticated: boolean;
}
