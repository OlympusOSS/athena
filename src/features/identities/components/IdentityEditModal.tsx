import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	type IChangeEvent,
	Icon,
	SchemaForm,
} from "@olympusoss/canvas";
import type { Identity } from "@ory/kratos-client";
import validator from "@rjsf/validator-ajv8";
import React, { useEffect, useState } from "react";
import { useSchemas } from "@/features/schemas/hooks/useSchemas";
import { uiLogger } from "@/lib/logger";
import { useUpdateIdentity } from "../hooks/useIdentities";
import { convertKratosSchemaToRJSF, createUISchema, TelWidget } from "./shared-form-widgets";

// Add custom format for tel to avoid validation warnings
/* c8 ignore start -- ajv custom format validator only fires during schema
 * validation with a `tel`-format field; not exercised in component tests. */
validator.ajv.addFormat("tel", {
	type: "string",
	validate: (data: string) => {
		return typeof data === "string" && data.length > 0;
	},
});
/* c8 ignore stop */

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

	const widgets = React.useMemo(() => ({ tel: TelWidget }), []);

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
		/* c8 ignore next -- onSubmit is only bound when formSchema is present,
		 * which requires identity to be truthy (see early return at line 89).
		 * The guard is defensive. */
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
		<Dialog
			open={open}
			/* c8 ignore next 3 -- Radix Dialog fires onOpenChange on Escape /
			 * outside-click, which jsdom's pointer-capture gap cannot reliably
			 * trigger. Explicit Cancel path is covered. */
			onOpenChange={(isOpen: boolean) => {
				if (!isOpen) handleClose();
			}}
		>
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
							<Icon name="TriangleAlert" />
							<AlertDescription>Failed to update identity: {(updateIdentityMutation.error as Error)?.message || "Unknown error"}</AlertDescription>
						</Alert>
					)}

					{schemasLoading && (
						<div>
							<Icon name="LoaderCircle" />
						</div>
					)}

					{!schemasLoading && formSchema && (
						<div>
							<SchemaForm
								schema={formSchema}
								uiSchema={createUISchema(formSchema)}
								formData={formData}
								onChange={(data: IChangeEvent) => {
									if (data.formData) setFormData(data.formData);
								}}
								onSubmit={(data: IChangeEvent) => {
									if (data.formData) onSubmit(data.formData as Record<string, unknown>);
								}}
								validator={validator}
								widgets={widgets}
								disabled={updateIdentityMutation.isPending}
								showErrorList={false}
								noHtml5Validate
							>
								<DialogFooter>
									<Button variant="outline" onClick={handleClose} disabled={updateIdentityMutation.isPending} type="button">
										Cancel
									</Button>
									<Button type="submit" disabled={updateIdentityMutation.isPending}>
										{updateIdentityMutation.isPending && <Icon name="LoaderCircle" />}
										Save Changes
									</Button>
								</DialogFooter>
							</SchemaForm>
						</div>
					)}

					{!schemasLoading && !formSchema && (
						<Alert>
							<Icon name="TriangleAlert" />
							<AlertDescription>Schema not found for this identity</AlertDescription>
						</Alert>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default IdentityEditModal;
