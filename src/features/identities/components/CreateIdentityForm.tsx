import {
	Alert,
	AlertDescription,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Icon,
	Label,
	LoadingState,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Separator,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@olympusoss/canvas";
import type { IdentitySchemaContainer } from "@ory/kratos-client";
import Form, { type IChangeEvent } from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useSchemas } from "@/features/schemas/hooks/useSchemas";
import { useCreateIdentity } from "../hooks/useIdentities";
import {
	convertKratosSchemaToRJSF,
	createUISchema,
	FieldTemplate,
	ObjectFieldTemplate,
	SelectWidget,
	SubmitButton,
	TelWidget,
	TextWidget,
} from "./shared-form-widgets";

// Add custom format for tel to avoid validation warnings
validator.ajv.addFormat("tel", {
	type: "string",
	validate: (data: string) => {
		// Basic phone number validation - allow any string that could be a phone number
		return typeof data === "string" && data.length > 0;
	},
});

interface CreateIdentityFormProps {
	onSuccess?: () => void;
	onCancel?: () => void;
}

const CreateIdentityForm: React.FC<CreateIdentityFormProps> = ({ onSuccess, onCancel }) => {
	const router = useRouter();
	const createIdentityMutation = useCreateIdentity();
	const { data: schemas, isLoading: schemasLoading } = useSchemas();

	const [selectedSchemaId, setSelectedSchemaId] = useState<string>("");
	const [formData, setFormData] = useState<Record<string, unknown>>({});
	const [formSchema, setFormSchema] = useState<Record<string, unknown> | null>(null);

	// Custom widgets for better form experience
	const widgets = React.useMemo(
		() => ({
			tel: TelWidget,
			TextWidget: TextWidget,
			SelectWidget: SelectWidget,
			text: TextWidget,
			email: TextWidget,
		}),
		[],
	);

	// Custom templates for styling
	const templates = React.useMemo(
		() => ({
			FieldTemplate: FieldTemplate,
			ObjectFieldTemplate: ObjectFieldTemplate,
			SubmitButton: SubmitButton,
		}),
		[],
	);

	const handleSchemaChange = (schemaId: string) => {
		setSelectedSchemaId(schemaId);
		setFormData({});

		if (schemaId && schemas) {
			const selectedSchema = schemas.find((s: IdentitySchemaContainer) => s.id === schemaId);
			if (selectedSchema?.schema) {
				const rjsfSchema = convertKratosSchemaToRJSF(selectedSchema.schema);
				setFormSchema(rjsfSchema);
			}
		} else {
			setFormSchema(null);
		}
	};

	const handleSubmit = async (submitData: Record<string, unknown>) => {
		try {
			await createIdentityMutation.mutateAsync({
				schemaId: selectedSchemaId,
				traits: submitData,
			});

			onSuccess?.();
			router.push("/identities");
		} catch (error) {
			console.error("Failed to create identity:", error);
		}
	};

	const handleCancel = () => {
		onCancel?.();
		router.push("/identities");
	};

	if (schemasLoading) {
		return <LoadingState message="Loading schemas..." />;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Identity Schema</CardTitle>
			</CardHeader>
			<CardContent>
				{createIdentityMutation.isError && (
					<Alert variant="destructive">
						<Icon name="alert-circle" />
						<AlertDescription>Failed to create identity: {(createIdentityMutation.error as Error)?.message || "Unknown error"}</AlertDescription>
					</Alert>
				)}

				<Label htmlFor="identity-schema">
					Identity Schema <span>*</span>
				</Label>
				<Select value={selectedSchemaId} onValueChange={handleSchemaChange} disabled={createIdentityMutation.isPending}>
					<SelectTrigger id="identity-schema">
						<SelectValue placeholder="Select a schema..." />
					</SelectTrigger>
					<SelectContent>
						{schemas?.map((schema: IdentitySchemaContainer) => (
							<TooltipProvider key={schema.id} delayDuration={0}>
								<Tooltip>
									<TooltipTrigger asChild>
										<SelectItem value={schema.id || ""}>{((schema.schema as Record<string, unknown>)?.title as string) || schema.id}</SelectItem>
									</TooltipTrigger>
									<TooltipContent side="right">Schema ID: {schema.id}</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						))}
					</SelectContent>
				</Select>
			</CardContent>

			{selectedSchemaId && formSchema && (
				<>
					<Separator />
					<CardHeader>
						<CardTitle>Identity Traits</CardTitle>
					</CardHeader>
					<CardContent>
						<Form
							schema={formSchema}
							uiSchema={createUISchema(formSchema)}
							formData={formData}
							onChange={(data: IChangeEvent) => {
								if (data.formData) setFormData(data.formData);
							}}
							onSubmit={(data: IChangeEvent) => {
								if (data.formData) handleSubmit(data.formData as Record<string, unknown>);
							}}
							validator={validator}
							customValidate={(_, errors) => {
								// Allow submission even with empty optional fields
								return errors;
							}}
							widgets={widgets}
							templates={templates}
							disabled={createIdentityMutation.isPending}
							showErrorList={false}
							noHtml5Validate
							onError={(errors: unknown[]) => {
								console.error("Form validation errors:", errors);
							}}
						>
							<Separator />
							<CardContent>
								<Button variant="outline" onClick={handleCancel} disabled={createIdentityMutation.isPending} type="button">
									<Icon name="x" />
									Cancel
								</Button>
								<Button type="submit" disabled={createIdentityMutation.isPending || !selectedSchemaId}>
									{createIdentityMutation.isPending ? <Icon name="loader" /> : <Icon name="save" />}
									{createIdentityMutation.isPending ? "Creating..." : "Create Identity"}
								</Button>
							</CardContent>
						</Form>
					</CardContent>
				</>
			)}

			{selectedSchemaId && !formSchema && (
				<>
					<Separator />
					<CardContent>
						<Button variant="outline" onClick={handleCancel} disabled={createIdentityMutation.isPending}>
							<Icon name="x" />
							Cancel
						</Button>
						<Button disabled>No form fields available</Button>
					</CardContent>
				</>
			)}
		</Card>
	);
};

export default React.memo(CreateIdentityForm);
