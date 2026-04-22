import { PhoneInput } from "@olympusoss/canvas";
import type { WidgetProps } from "@rjsf/utils";

/**
 * Kratos-specific form helpers. The generic Canvas-themed widgets + templates
 * ship from `@olympusoss/canvas`'s `SchemaForm` (as `canvasSchemaFormWidgets` /
 * `canvasSchemaFormTemplates`). This file only keeps the pieces that encode
 * Kratos domain knowledge.
 */

/** RJSF adapter around Canvas's `PhoneInput`. */
export const TelWidget: React.FC<WidgetProps> = ({ id, value, onChange, label, placeholder, disabled, readonly, required }) => (
	<PhoneInput
		id={id}
		value={value}
		onChange={(v) => onChange(v)}
		label={label}
		placeholder={placeholder}
		disabled={disabled}
		readonly={readonly}
		required={required}
	/>
);

/** Extract Kratos identity `traits` schema into an RJSF-compatible root schema. */
export const convertKratosSchemaToRJSF = (kratosSchema: unknown) => {
	const schemaObj = kratosSchema as Record<string, unknown>;
	const properties = schemaObj?.properties as Record<string, unknown> | undefined;
	const traits = properties?.traits as Record<string, unknown> | undefined;

	if (traits) {
		return {
			title: "Identity Traits",
			type: "object",
			properties: (traits as Record<string, unknown>).properties,
			required: (traits as Record<string, unknown>).required || [],
		};
	}

	return {
		title: "Identity Traits",
		type: "object",
		properties: {},
	};
};

/** Build an RJSF UI schema that maps Kratos formats to appropriate widgets. */
export const createUISchema = (schema: Record<string, unknown>) => {
	const uiSchema: Record<string, unknown> = {};
	const schemaProperties = (schema.properties || {}) as Record<string, Record<string, unknown>>;

	Object.keys(schemaProperties).forEach((key) => {
		const property = schemaProperties[key];

		if (property.format === "email") {
			uiSchema[key] = { "ui:widget": "email" };
		} else if (property.format === "tel") {
			uiSchema[key] = { "ui:widget": "tel" };
		}

		if (property.type === "object" && property.properties) {
			uiSchema[key] = { "ui:field": "object" };
		}
	});

	return uiSchema;
};
