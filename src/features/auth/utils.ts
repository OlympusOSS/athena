import type { Session } from "@ory/kratos-client";
import { type AuthUser, UserRole } from "./types";

/**
 * Convert a Kratos session to an AuthUser object
 * Maps identity traits from iam-kratos to the AuthUser interface
 */
export const sessionToAuthUser = (session: Session): AuthUser => {
	const traits = session.identity?.traits as
		| {
				email?: string;
				name?: string;
				role?: string;
		  }
		| undefined;

	return {
		id: session.identity?.id || "",
		email: traits?.email || "",
		displayName: traits?.name || traits?.email || "Unknown User",
		role: (traits?.role as UserRole) || UserRole.VIEWER,
	};
};

/**
 * Check if user has admin role
 */
export const isAdmin = (user: AuthUser | null): boolean => {
	return user?.role === UserRole.ADMIN;
};

/**
 * Check if user has viewer role or higher
 */
export const canView = (user: AuthUser | null): boolean => {
	return user?.role === UserRole.ADMIN || user?.role === UserRole.VIEWER;
};

/**
 * Demo accounts for the login page
 * These correspond to the seeded iam-kratos identities
 */
export const DEMO_ACCOUNTS = [
	{
		email: "bobby@nannier.com",
		password: "admin123!",
		role: UserRole.ADMIN,
		displayName: "Bobby Nannier",
	},
	{
		email: "marine@nannier.com",
		password: "admin123!",
		role: UserRole.VIEWER,
		displayName: "Marine Nannier",
	},
] as const;
