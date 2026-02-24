"use client";

import { useEffect, useState } from "react";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";
import { Button, Icon, Input, Label, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn } from "@olympus/canvas";

export interface ApiKeyFieldProps<TFieldValues extends FieldValues = FieldValues> {
	name: FieldPath<TFieldValues>;
	control: Control<TFieldValues>;
	label: string;
	placeholder?: string;
	helperText?: string;
	hasExistingKey: boolean;
	isEditing: boolean;
	onEditStart: () => void;
	error?: string;
	fullWidth?: boolean;
}

export function ApiKeyField<TFieldValues extends FieldValues = FieldValues>({
	name,
	control,
	label,
	placeholder = "ory_pat_xxx",
	helperText,
	hasExistingKey,
	isEditing,
	onEditStart,
	error,
	fullWidth = true,
}: ApiKeyFieldProps<TFieldValues>) {
	const [showPassword, setShowPassword] = useState(false);

	useEffect(() => {
		if (!isEditing) {
			setShowPassword(false);
		}
	}, [isEditing]);

	const handleToggleVisibility = (): void => {
		setShowPassword(!showPassword);
	};

	// Masked display mode
	if (hasExistingKey && !isEditing) {
		return (
			<div className="space-y-1.5">
				{label && <Label>{label}</Label>}
				<div className="relative flex items-center">
					<Icon name="lock" className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
					<Input
						value="••••••••••••••••"
						disabled
						className="pl-8 pr-10 text-sm"
					/>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={onEditStart}
									aria-label="edit api key"
									type="button"
									className="absolute right-1 h-7 w-7"
								>
									<Icon name="edit" className="h-3.5 w-3.5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Edit API key</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
				<p className="text-xs text-muted-foreground">API key is set and encrypted</p>
			</div>
		);
	}

	// Edit mode
	return (
		<Controller
			name={name}
			control={control}
			render={({ field }) => (
				<div className="space-y-1.5">
					{label && <Label>{label}</Label>}
					<div className="relative flex items-center">
						<Icon name="key" className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							{...field}
							placeholder={placeholder}
							type={showPassword ? "text" : "password"}
							className="pl-8 pr-10 text-sm"
						/>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										onClick={handleToggleVisibility}
										aria-label="toggle api key visibility"
										type="button"
										className="absolute right-1 h-7 w-7"
									>
										{showPassword ? (
											<Icon name="eye-off" className="h-3.5 w-3.5" />
										) : (
											<Icon name="view" className="h-3.5 w-3.5" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{showPassword ? "Hide API key" : "Show API key"}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
					<p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
						{error || helperText || "Enter your API key - it will be encrypted"}
					</p>
				</div>
			)}
		/>
	);
}

ApiKeyField.displayName = "ApiKeyField";
