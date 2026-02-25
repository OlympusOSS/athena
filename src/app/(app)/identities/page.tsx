"use client";

import { Icon, LoadingState } from "@olympusoss/canvas";
import { lazy, Suspense } from "react";
import { PageHeader, ProtectedPage } from "@/components/layout";
import { UserRole } from "@/features/auth";

const IdentitiesTable = lazy(() => import("@/features/identities/components/IdentitiesTable"));

export default function IdentitiesPage() {
	return (
		<ProtectedPage requiredRole={UserRole.ADMIN}>
			<PageHeader title="Identities" subtitle="Manage user identities in your Kratos instance" icon={<Icon name="users" />} />
			<Suspense fallback={<LoadingState variant="page" />}>
				<IdentitiesTable />
			</Suspense>
		</ProtectedPage>
	);
}
