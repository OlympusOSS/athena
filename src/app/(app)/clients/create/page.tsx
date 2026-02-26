"use client";

import { Button, Icon } from "@olympusoss/canvas";
import { useRouter } from "next/navigation";
import { AdminLayout, PageHeader } from "@/components/layout";
import type { OAuth2ClientFormData } from "@/features/oauth2-clients";
import { getDefaultOAuth2ClientFormData, OAuth2ClientForm, transformFormDataToCreateRequest, useCreateOAuth2Client } from "@/features/oauth2-clients";

export default function CreateOAuth2ClientPage() {
	const router = useRouter();
	const createClientMutation = useCreateOAuth2Client();

	const handleSubmit = async (formData: OAuth2ClientFormData) => {
		const requestData = transformFormDataToCreateRequest(formData);
		const result = await createClientMutation.mutateAsync(requestData);

		if (result.data.client_id) {
			router.push(`/clients/${result.data.client_id}`);
		}
	};

	return (
		<AdminLayout>
			<div className="space-y-6">
				<PageHeader
					title="Create OAuth2 Client"
					subtitle="Configure a new OAuth2 client application"
					icon={<Icon name="grid" />}
					breadcrumbs={[
						{ label: "OAuth2 Clients", href: "/clients" },
						{ label: "Create" },
					]}
				/>

				<OAuth2ClientForm
					initialData={getDefaultOAuth2ClientFormData()}
					onSubmit={handleSubmit}
					submitButtonLabel="Create Client"
					isSubmitting={createClientMutation.isPending}
					error={createClientMutation.error}
					onCancel={() => router.back()}
				/>
			</div>
		</AdminLayout>
	);
}
