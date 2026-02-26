"use client";

import { ErrorState, Icon, LoadingState } from "@olympusoss/canvas";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { AdminLayout, PageHeader } from "@/components/layout";
import type { OAuth2ClientFormData } from "@/features/oauth2-clients";
import {
	OAuth2ClientForm,
	transformFormDataToCreateRequest,
	transformOAuth2ClientToFormData,
	useOAuth2Client,
	useUpdateOAuth2Client,
} from "@/features/oauth2-clients";

interface Props {
	params: Promise<{ id: string }>;
}

export default function EditOAuth2ClientPage({ params }: Props) {
	const resolvedParams = use(params);
	const router = useRouter();
	const [initialFormData, setInitialFormData] = useState<OAuth2ClientFormData | null>(null);

	const { data: clientResponse, isLoading, error } = useOAuth2Client(resolvedParams.id);
	const updateClientMutation = useUpdateOAuth2Client();

	const client = clientResponse?.data;

	// Initialize form data when client is loaded
	useEffect(() => {
		if (client && !initialFormData) {
			setInitialFormData(transformOAuth2ClientToFormData(client));
		}
	}, [client, initialFormData]);

	const handleSubmit = async (formData: OAuth2ClientFormData) => {
		const requestData = {
			...transformFormDataToCreateRequest(formData),
			client_id: resolvedParams.id,
		};

		await updateClientMutation.mutateAsync({
			clientId: resolvedParams.id,
			clientData: requestData,
		});

		router.push(`/clients/${resolvedParams.id}`);
	};

	if (error) {
		return (
			<AdminLayout>
				<div className="space-y-6">
					<ErrorState message={`Failed to load client: ${error.message}`} variant="page" />
				</div>
			</AdminLayout>
		);
	}

	if (isLoading || !initialFormData) {
		return (
			<AdminLayout>
				<div className="space-y-6">
					<LoadingState variant="page" />
				</div>
			</AdminLayout>
		);
	}

	return (
		<AdminLayout>
			<div className="space-y-6">
				<PageHeader
					title="Edit OAuth2 Client"
					subtitle="Update client configuration"
					icon={<Icon name="grid" />}
					breadcrumbs={[
						{ label: "OAuth2 Clients", href: "/clients" },
						{ label: "Edit" },
					]}
				/>

				<OAuth2ClientForm
					initialData={initialFormData}
					onSubmit={handleSubmit}
					submitButtonLabel="Update Client"
					isSubmitting={updateClientMutation.isPending}
					error={updateClientMutation.error}
					onCancel={() => router.back()}
				/>
			</div>
		</AdminLayout>
	);
}
