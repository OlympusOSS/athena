"use client";

/**
 * CreateM2MClientModal — Form for creating a new M2M OAuth2 client.
 *
 * Uses React Hook Form (per Athena quality gate) integrated with Canvas form components.
 *
 * Security:
 *   - Scope multi-select renders ONLY from M2M_PERMITTED_SCOPES (7 scopes)
 *   - No free-text scope input — selection-only
 *   - sessions:invalidate shows "High risk" badge (DA condition, athena#50 thread)
 *   - Scope descriptions shown below each scope (DX requirement athena#85)
 */

import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	Checkbox,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Icon,
	Input,
	Label,
} from "@olympusoss/canvas";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { M2M_HIGH_RISK_SCOPES, M2M_PERMITTED_SCOPES, M2M_SCOPE_DESCRIPTIONS } from "@/lib/m2m-scopes";

interface CreateM2MClientFormValues {
	client_name: string;
	scope: string[]; // UI stores as array; converted to space-separated string on submit
	token_lifetime: number;
}

interface CreateM2MClientModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (values: { client_name: string; scope: string; token_lifetime: number }) => Promise<void>;
	isSubmitting?: boolean;
	error?: Error | null;
}

export function CreateM2MClientModal({ open, onOpenChange, onSubmit, isSubmitting = false, error }: CreateM2MClientModalProps) {
	const {
		register,
		handleSubmit,
		watch,
		setValue,
		reset,
		formState: { errors },
	} = useForm<CreateM2MClientFormValues>({
		defaultValues: {
			client_name: "",
			scope: [],
			token_lifetime: 3600, // default: 3600s per PO AC3 / Architect update
		},
	});

	const selectedScopes = watch("scope");
	const tokenLifetime = watch("token_lifetime");

	// Reset form when modal closes
	useEffect(() => {
		if (!open) {
			reset();
		}
	}, [open, reset]);

	const toggleScope = (scope: string) => {
		const current = selectedScopes ?? [];
		if (current.includes(scope)) {
			setValue(
				"scope",
				current.filter((s) => s !== scope),
			);
		} else {
			setValue("scope", [...current, scope]);
			// AN-50-3: scope_selected event
			if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).__olympus_analytics) {
				((window as unknown as Record<string, unknown>).__olympus_analytics as (e: object) => void)({
					event: "admin.m2m_client.scope_selected",
					scope,
					action: "selected",
					current_scope_count: current.length + 1,
				});
			}
		}
	};

	const handleFormSubmit = handleSubmit(async (values) => {
		if ((values.scope ?? []).length === 0) return;
		await onSubmit({
			client_name: values.client_name,
			scope: (values.scope ?? []).join(" "),
			token_lifetime: values.token_lifetime,
		});
	});

	// Human-readable token lifetime preview
	const getLifetimePreview = (seconds: number): string => {
		if (!seconds || seconds <= 0) return "";
		if (seconds === 3600) return "= 1 hour (maximum)";
		if (seconds === 300) return "= 5 minutes (recommended for AI agents)";
		if (seconds < 60) return `= ${seconds} seconds`;
		if (seconds < 3600) {
			const mins = Math.floor(seconds / 60);
			const secs = seconds % 60;
			return secs > 0 ? `= ${mins}m ${secs}s` : `= ${mins} minutes`;
		}
		return `= ${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) !== 1 ? "s" : ""}`;
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						<Icon name="add" />
						Add M2M Client
					</DialogTitle>
					<DialogDescription>Register a machine-to-machine OAuth2 client for an AI agent or automated service.</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleFormSubmit} id="create-m2m-form">
					<div className="space-y-5">
						{/* Client Name */}
						<div className="space-y-1.5">
							<Label htmlFor="m2m-client-name">
								Client Name <span aria-hidden>*</span>
							</Label>
							<Input
								id="m2m-client-name"
								placeholder="Payment Processor Agent"
								aria-required
								aria-invalid={!!errors.client_name}
								{...register("client_name", { required: "Client name is required" })}
							/>
							{errors.client_name && <p className="text-xs text-destructive">{errors.client_name.message}</p>}
							<p className="text-xs text-muted-foreground">A descriptive name for this agent or service, e.g., "Provisioning Agent".</p>
						</div>

						{/* Scope Multi-select */}
						<div className="space-y-2">
							<Label>
								Allowed Scopes <span aria-hidden>*</span>
							</Label>
							<p className="text-xs text-muted-foreground">
								Select the minimum scopes required for this agent. Each scope grants a specific capability — grant only what is needed.
							</p>
							{(selectedScopes ?? []).length === 0 && (
								<p className="text-xs text-destructive" role="alert">
									At least one scope is required.
								</p>
							)}
							<div className="space-y-2 rounded-md border border-border p-3">
								{M2M_PERMITTED_SCOPES.map((scope) => {
									const isSelected = (selectedScopes ?? []).includes(scope);
									const isHighRisk = M2M_HIGH_RISK_SCOPES.has(scope);
									return (
										<div key={scope} className="flex items-start gap-3">
											<Checkbox id={`scope-${scope}`} checked={isSelected} onCheckedChange={() => toggleScope(scope)} />
											<div className="flex-1 space-y-0.5">
												<div className="flex items-center gap-2">
													<Label htmlFor={`scope-${scope}`} className="cursor-pointer font-mono text-sm">
														{scope}
													</Label>
													{isHighRisk && <Badge variant="destructive">High risk</Badge>}
												</div>
												<p className="text-xs text-muted-foreground">{M2M_SCOPE_DESCRIPTIONS[scope]}</p>
											</div>
										</div>
									);
								})}
							</div>
						</div>

						{/* Token Lifetime */}
						<div className="space-y-1.5">
							<Label htmlFor="m2m-token-lifetime">Token Lifetime (seconds)</Label>
							<div className="flex items-center gap-3">
								<Input
									id="m2m-token-lifetime"
									type="number"
									min={1}
									max={3600}
									aria-invalid={!!errors.token_lifetime}
									{...register("token_lifetime", {
										valueAsNumber: true,
										min: { value: 1, message: "Minimum is 1 second" },
										max: { value: 3600, message: "Maximum is 3600 seconds (1 hour)" },
									})}
								/>
								{tokenLifetime > 0 && <span className="text-xs text-muted-foreground whitespace-nowrap">{getLifetimePreview(tokenLifetime)}</span>}
							</div>
							{errors.token_lifetime && <p className="text-xs text-destructive">{errors.token_lifetime.message}</p>}
							<p className="text-xs text-muted-foreground">
								For AI agent tokens, 300 seconds is recommended. Maximum: 3600 seconds. No refresh tokens are issued — agents must re-authenticate on
								expiry.
							</p>
						</div>

						{/* Error Display */}
						{error && (
							<Alert variant="destructive">
								<AlertDescription>
									<Icon name="danger" />
									{error.message}
								</AlertDescription>
							</Alert>
						)}
					</div>
				</form>

				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button type="submit" form="create-m2m-form" disabled={isSubmitting || (selectedScopes ?? []).length === 0}>
						{isSubmitting ? (
							<>
								<Icon name="loading" />
								Creating...
							</>
						) : (
							<>
								<Icon name="add" />
								Create Client
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
