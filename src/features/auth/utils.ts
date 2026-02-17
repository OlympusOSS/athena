import type { Session } from "@ory/kratos-client";
import { type AuthUser, UserRole } from "./types";

/**
 * Convert a Kratos session to an AuthUser.
 * Maps identity traits (email, name, role) from the IAM Kratos schema.
 */
export function sessionToAuthUser(session: Session): AuthUser {
	const identity = session.identity;
	if (!identity) {
		throw new Error("Session has no identity");
	}

	const traits = identity.traits as {
		email?: string;
		name?: { first?: string; last?: string };
		role?: string;
	};

	const email = traits.email || "";
	const firstName = traits.name?.first || "";
	const lastName = traits.name?.last || "";
	const displayName = [firstName, lastName].filter(Boolean).join(" ") || email;
	const role = traits.role === "admin" ? UserRole.ADMIN : UserRole.VIEWER;

	return {
		kratosIdentityId: identity.id,
		email,
		role,
		displayName,
	};
}

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
