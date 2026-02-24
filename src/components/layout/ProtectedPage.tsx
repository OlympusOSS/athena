"use client";

import type { ReactNode } from "react";
import type { UserRole } from "@/features/auth";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { AdminLayout } from "./AdminLayout";

export interface ProtectedPageProps {
	requiredRole?: UserRole;
	children: ReactNode;
	layout?: boolean;
}

export function ProtectedPage({ requiredRole, children, layout = true }: ProtectedPageProps) {
	const content = layout ? <AdminLayout>{children}</AdminLayout> : children;

	if (requiredRole) {
		return <ProtectedRoute requiredRole={requiredRole}>{content}</ProtectedRoute>;
	}

	return <>{content}</>;
}

ProtectedPage.displayName = "ProtectedPage";
