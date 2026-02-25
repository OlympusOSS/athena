"use client";

import { Badge, EmptyState, Icon, LoadingState } from "@olympusoss/canvas";
import type { IdentitySchemaContainer } from "@ory/kratos-client";
import type React from "react";
import { formatSchemaForDisplay } from "../utils";

interface SchemaListProps {
	schemas: IdentitySchemaContainer[];
	loading: boolean;
	selectedSchemaId?: string;
	onSchemaSelect: (schema: IdentitySchemaContainer) => void;
}

const SchemaList: React.FC<SchemaListProps> = ({ schemas, loading, selectedSchemaId, onSchemaSelect }) => {
	if (loading) {
		return (
			<div>
				<LoadingState variant="section" message="Loading schemas..." />
			</div>
		);
	}

	if (schemas.length === 0) {
		return (
			<div>
				<EmptyState icon={<Icon name="file-code" />} title="No schemas found" description="No identity schemas are currently configured" />
			</div>
		);
	}

	return (
		<div>
			{schemas.map((schema) => {
				const formattedSchema = formatSchemaForDisplay(schema);
				const _isSelected = selectedSchemaId === schema.id;

				return (
					<button key={schema.id} type="button" onClick={() => onSchemaSelect(schema)}>
						<div>
							<Icon name="file-code" />
						</div>
						<div>
							<div>
								<span>{formattedSchema.displayName}</span>
								{formattedSchema.isDefault && <Badge variant="secondary">Default</Badge>}
							</div>
							<p>{formattedSchema.description}</p>
							<span>
								{formattedSchema.fieldCount} fields &bull; ID: {schema.id}
							</span>
						</div>
					</button>
				);
			})}
		</div>
	);
};

export default SchemaList;
