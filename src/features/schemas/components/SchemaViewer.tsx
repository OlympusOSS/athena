"use client";

import { Badge, LoadingState } from "@olympus/canvas";
import type { IdentitySchemaContainer } from "@ory/kratos-client";
import type React from "react";
import { extractSchemaFields, formatSchemaForDisplay } from "../utils";

interface SchemaViewerProps {
	schema: IdentitySchemaContainer;
	loading?: boolean;
}

const SchemaViewer: React.FC<SchemaViewerProps> = ({ schema, loading = false }) => {
	if (loading) {
		return (
			<div>
				<LoadingState variant="section" message="Loading schema details..." />
			</div>
		);
	}

	const formattedSchema = formatSchemaForDisplay(schema);
	const schemaObj = typeof schema.schema === "string" ? JSON.parse(schema.schema) : schema.schema;
	const fields = extractSchemaFields(schemaObj);

	return (
		<div>
			<h2>{formattedSchema.displayName}</h2>

			<p>{formattedSchema.description}</p>

			<div>
				<span>Schema ID: {schema.id}</span>
				{formattedSchema.isDefault && <Badge>Default Schema</Badge>}
			</div>

			<div>
				<span>Fields ({formattedSchema.fieldCount}):</span>
				<div>
					{fields.map((field) => (
						<Badge key={field} variant="secondary">
							{field}
						</Badge>
					))}
				</div>
			</div>

			<div>
				<span>Schema Definition:</span>
				<pre>{JSON.stringify(schemaObj, null, 2)}</pre>
			</div>
		</div>
	);
};

export default SchemaViewer;
