"use client";

import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserRole } from "@/features/auth";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import CreateIdentityForm from "@/features/identities/components/CreateIdentityForm";

export default function CreateIdentityPage() {
	return (
		<ProtectedRoute requiredRole={UserRole.ADMIN}>
			<AdminLayout>
				<PageHeader
					title="Create New Identity"
					subtitle="Create a new user identity in your Kratos instance. Select a schema to see the required fields."
					breadcrumbs={[{ label: "Identities", href: "/identities" }, { label: "Create New" }]}
				/>
				<CreateIdentityForm />
			</AdminLayout>
		</ProtectedRoute>
	);
}
