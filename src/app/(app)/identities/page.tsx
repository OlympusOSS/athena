"use client";

import { Icon, LoadingState } from "@olympusoss/canvas";
import { lazy, Suspense } from "react";
import { PageHeader, ProtectedPage } from "@/components/layout";
import { UserRole } from "@/features/auth";

const IdentitiesTable = lazy(() => import("@/features/identities/components/IdentitiesTable"));

export default function IdentitiesPage() {
	return (
		<ProtectedPage requiredRole={UserRole.ADMIN}>
			<PageHeader title="Identities" subtitle="Manage user identities in your identity service" icon={<Icon name="Users" />} />
			<Suspense fallback={<LoadingState />}>
				<IdentitiesTable />
			</Suspense>
		</ProtectedPage>
	);
}
