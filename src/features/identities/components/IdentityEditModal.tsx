import type { Identity } from "@ory/kratos-client";
import Form, { type IChangeEvent } from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import React, { useEffect, useState } from "react";
import { Alert, AlertDescription, Icon } from "@olympus/canvas";
import { Badge } from "@olympus/canvas";
import { Button } from "@olympus/canvas";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@olympus/canvas";
import { useSchemas } from "@/features/schemas/hooks/useSchemas";
import { uiLogger } from "@/lib/logger";
import { useUpdateIdentity } from "../hooks/useIdentities";
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
		return typeof data === "string" && data.length > 0;
	},
});

interface IdentityEditModalProps {
	open: boolean;
	onClose: () => void;
	identity: Identity | null;
	onSuccess?: () => void;
}

export const IdentityEditModal: React.FC<IdentityEditModalProps> = ({ open, onClose, identity, onSuccess }) => {
	const updateIdentityMutation = useUpdateIdentity();
	const { data: schemas, isLoading: schemasLoading } = useSchemas();
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

	// Initialize form data when identity changes
	useEffect(() => {
		if (identity && schemas) {
			const schema = schemas.find((s) => s.id === identity.schema_id);
			if (schema?.schema) {
				const rjsfSchema = convertKratosSchemaToRJSF(schema.schema);
				setFormSchema(rjsfSchema);
				setFormData((identity.traits as Record<string, unknown>) || {});
				uiLogger.debug("Initialized form with identity traits:", identity.traits);
			}
		}
	}, [identity, schemas]);

	const onSubmit = async (submitData: Record<string, unknown>) => {
		if (!identity) return;

		try {
			uiLogger.debug("Submitting identity update:", {
				originalIdentity: identity,
				formData: submitData,
			});

			await updateIdentityMutation.mutateAsync({
				id: identity.id,
				schemaId: identity.schema_id,
				traits: submitData,
			});

			onSuccess?.();
			onClose();
		} catch (error) {
			uiLogger.logError(error, "Failed to update identity");
		}
	};

	const handleClose = () => {
		if (!updateIdentityMutation.isPending) {
			setFormData({});
			onClose();
		}
	};

	if (!identity) return null;

	return (
		<Dialog open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) handleClose(); }}>
			<DialogContent>
				<DialogHeader>
					<div>
						<DialogTitle>Edit Identity</DialogTitle>
						<Badge variant="outline">{identity.schema_id}</Badge>
					</div>
					<DialogDescription>
						<code>{identity.id}</code>
					</DialogDescription>
				</DialogHeader>

				<div>
					{updateIdentityMutation.isError && (
						<Alert variant="destructive">
							<Icon name="danger" />
							<AlertDescription>
								Failed to update identity: {(updateIdentityMutation.error as Error)?.message || "Unknown error"}
							</AlertDescription>
						</Alert>
					)}

					{schemasLoading && (
						<div>
							<Icon name="loading" />
						</div>
					)}

					{!schemasLoading && formSchema && (
						<div>
							<Form
								schema={formSchema}
								uiSchema={createUISchema(formSchema)}
								formData={formData}
								onChange={(data: IChangeEvent) => { if (data.formData) setFormData(data.formData); }}
								onSubmit={(data: IChangeEvent) => { if (data.formData) onSubmit(data.formData as Record<string, unknown>); }}
								validator={validator}
								widgets={widgets}
								templates={templates}
								disabled={updateIdentityMutation.isPending}
								showErrorList={false}
								noHtml5Validate
							>
								<DialogFooter>
									<Button
										variant="outline"
										onClick={handleClose}
										disabled={updateIdentityMutation.isPending}
										type="button"
									>
										Cancel
									</Button>
									<Button
										type="submit"
										disabled={updateIdentityMutation.isPending}
									>
										{updateIdentityMutation.isPending && (
											<Icon name="loading" />
										)}
										Save Changes
									</Button>
								</DialogFooter>
							</Form>
						</div>
					)}

					{!schemasLoading && !formSchema && (
						<Alert>
							<Icon name="danger" />
							<AlertDescription>Schema not found for this identity</AlertDescription>
						</Alert>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default IdentityEditModal;
