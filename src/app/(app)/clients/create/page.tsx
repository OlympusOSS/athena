"use client";

import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button, Icon } from "@olympus/canvas";
import type { OAuth2ClientFormData } from "@/features/oauth2-clients";
import {
	getDefaultOAuth2ClientFormData,
	OAuth2ClientForm,
	transformFormDataToCreateRequest,
	useCreateOAuth2Client,
} from "@/features/oauth2-clients";

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
				{/* Header */}
				<div className="flex items-center gap-3">
					<Button variant="ghost" size="icon" onClick={() => router.back()}>
						<Icon name="arrow-left" />
					</Button>
					<Icon name="grid" />
					<div className="space-y-1">
						<h1 className="text-2xl font-bold text-foreground">Create OAuth2 Client</h1>
						<p className="text-sm text-muted-foreground">Configure a new OAuth2 client application</p>
					</div>
				</div>

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
