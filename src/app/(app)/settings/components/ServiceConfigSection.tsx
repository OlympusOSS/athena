"use client";

import { Alert, AlertDescription, Button, cn, Icon, Input, Label } from "@olympusoss/canvas";
import { Controller, type UseFormReturn } from "react-hook-form";
import { ApiKeyField } from "@/components/forms";
import type { ServiceEndpoints, ServiceEndpointsForm } from "../hooks";

export interface ServiceConfigSectionProps {
	serviceName: "Kratos" | "Hydra";
	form: UseFormReturn<ServiceEndpointsForm>;
	currentEndpoints: ServiceEndpoints;
	publicUrlPlaceholder: string;
	adminUrlPlaceholder: string;
	publicUrlHelperText: string;
	adminUrlHelperText: string;
	onSave: (data: ServiceEndpointsForm) => Promise<void>;
	validateUrl: (url: string) => string | true;
	isEditingApiKey: boolean;
	onApiKeyEditStart: () => void;
	/** Show a bottom divider (when another section follows) */
	showDivider?: boolean;
}

const serviceConfig = {
	Kratos: {
		iconName: "shield" as const,
		description: "Identity & User Management",
	},
	Hydra: {
		iconName: "key" as const,
		description: "OAuth2 & OpenID Connect",
	},
};

export function ServiceConfigSection({
	serviceName,
	form,
	currentEndpoints,
	publicUrlPlaceholder,
	adminUrlPlaceholder,
	publicUrlHelperText,
	adminUrlHelperText,
	onSave,
	validateUrl,
	isEditingApiKey,
	onApiKeyEditStart,
	showDivider = false,
}: ServiceConfigSectionProps) {
	const {
		handleSubmit,
		control,
		formState: { errors, isDirty, isSubmitting },
	} = form;

	const config = serviceConfig[serviceName];

	return (
		<div className={cn(showDivider && "mb-6 border-b border-border pb-6")}>
			{/* Service header */}
			<div className="mb-4 flex items-center gap-2">
				<Icon name={config.iconName} className="h-4 w-4 text-muted-foreground" />
				<span className="text-sm font-medium text-foreground">Ory {serviceName}</span>
				<span className="text-xs text-muted-foreground">&mdash; {config.description}</span>
			</div>

			<form onSubmit={handleSubmit(onSave)} className="space-y-4">
				{/* URL fields in 2-col grid */}
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-1.5">
						<Label htmlFor={`${serviceName}-publicUrl`} className="text-xs">
							Public URL
						</Label>
						<Controller
							name="publicUrl"
							control={control}
							rules={{ validate: validateUrl }}
							render={({ field }) => (
								<>
									<div className="relative">
										<Icon name="globe" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
										<Input {...field} id={`${serviceName}-publicUrl`} placeholder={publicUrlPlaceholder} className="pl-8 text-sm" />
									</div>
									<p className={cn("text-xs", errors.publicUrl ? "text-destructive" : "text-muted-foreground")}>
										{errors.publicUrl?.message || publicUrlHelperText}
									</p>
								</>
							)}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor={`${serviceName}-adminUrl`} className="text-xs">
							Admin URL
						</Label>
						<Controller
							name="adminUrl"
							control={control}
							rules={{ validate: validateUrl }}
							render={({ field }) => (
								<>
									<div className="relative">
										<Icon name="lock" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
										<Input {...field} id={`${serviceName}-adminUrl`} placeholder={adminUrlPlaceholder} className="pl-8 text-sm" />
									</div>
									<p className={cn("text-xs", errors.adminUrl ? "text-destructive" : "text-muted-foreground")}>
										{errors.adminUrl?.message || adminUrlHelperText}
									</p>
								</>
							)}
						/>
					</div>
				</div>

				{/* API Key */}
				<div className="space-y-1.5">
					<div className="flex items-center gap-2">
						<Label className="text-xs">API Key</Label>
						{currentEndpoints.apiKey?.trim() && (
							<span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-success">Configured</span>
						)}
					</div>
					<ApiKeyField
						name="apiKey"
						control={control}
						label=""
						hasExistingKey={!!currentEndpoints.apiKey?.trim()}
						isEditing={isEditingApiKey}
						onEditStart={onApiKeyEditStart}
						error={errors.apiKey?.message}
					/>
					<Alert className="py-2">
						<AlertDescription className="text-xs">API keys are encrypted before storage. Required for Ory Network authentication.</AlertDescription>
					</Alert>
				</div>

				{/* Save button */}
				<div className="flex justify-end">
					<Button type="submit" size="sm" disabled={(!isDirty && !isEditingApiKey) || isSubmitting}>
						{isSubmitting ? "Saving..." : `Save ${serviceName} Settings`}
					</Button>
				</div>
			</form>
		</div>
	);
}

ServiceConfigSection.displayName = "ServiceConfigSection";
