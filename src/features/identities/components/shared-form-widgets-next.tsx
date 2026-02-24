"use client";

import type {
	FieldTemplateProps,
	ObjectFieldTemplateProps,
	SubmitButtonProps,
	WidgetProps,
} from "@rjsf/utils";
import parsePhoneNumber, {
	type CountryCode,
	getCountries,
	getCountryCallingCode,
	isValidPhoneNumber,
} from "libphonenumber-js";
import React, { useCallback, useEffect, useState } from "react";
import { Input } from "@olympus/canvas";
import { Label } from "@olympus/canvas";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@olympus/canvas";
import { cn } from "@olympus/canvas";

// ----- Country options -----

export const getCountryOptions = () => {
	return getCountries()
		.map((countryCode) => {
			const callingCode = getCountryCallingCode(countryCode);
			const name =
				new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) ||
				countryCode;
			return {
				code: countryCode,
				name,
				callingCode: `+${callingCode}`,
				label: `${name} (+${callingCode})`,
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
};

// ----- TelWidget -----

export const TelWidget: React.FC<WidgetProps> = ({
	id,
	value,
	onChange,
	onBlur,
	onFocus,
	placeholder,
	disabled,
	readonly,
	required,
	label,
}) => {
	const [selectedCountry, setSelectedCountry] = useState<CountryCode>("US");
	const [phoneInput, setPhoneInput] = useState("");
	const [error, setError] = useState("");
	const [validity, setValidity] = useState<boolean | null>(null);

	const countryOptions = getCountryOptions();

	useEffect(() => {
		if (value) {
			try {
				const parsed = parsePhoneNumber(value);
				if (parsed) {
					setSelectedCountry(parsed.country || "US");
					setPhoneInput(parsed.nationalNumber || "");
				} else {
					setPhoneInput(value);
				}
			} catch {
				setPhoneInput(value);
			}
		}
	}, [value]);

	const handlePhoneChange = (newInput: string) => {
		setPhoneInput(newInput);
		setError("");

		if (!newInput.trim()) {
			onChange("");
			setValidity(null);
			return;
		}

		try {
			const phoneNumber = parsePhoneNumber(newInput, selectedCountry);
			if (phoneNumber?.isValid()) {
				onChange(phoneNumber.formatInternational());
				setError("");
				setValidity(true);
			} else {
				const valid = isValidPhoneNumber(newInput, selectedCountry);
				onChange(newInput);
				if (newInput.length > 3 && !valid) {
					setError("Invalid phone number format");
					setValidity(false);
				} else if (newInput.length <= 3) {
					setValidity(null);
				}
			}
		} catch {
			const valid = isValidPhoneNumber(newInput, selectedCountry);
			onChange(newInput);
			if (newInput.length > 3 && !valid) {
				setError("Invalid phone number format");
				setValidity(false);
			} else if (newInput.length <= 3) {
				setValidity(null);
			}
		}
	};

	const handleCountryChange = (code: string) => {
		const newCountry = code as CountryCode;
		setSelectedCountry(newCountry);
		if (phoneInput) {
			try {
				const phoneNumber = parsePhoneNumber(phoneInput, newCountry);
				if (phoneNumber?.isValid()) {
					onChange(phoneNumber.formatInternational());
					setError("");
				}
			} catch {
				// ignore
			}
		}
	};

	const currentCountry = countryOptions.find((c) => c.code === selectedCountry);

	return (
		<div>
			<Label htmlFor={id}>
				{label || "Phone Number"}
				{required && <span>*</span>}
			</Label>
			<div>
				<Select
					value={selectedCountry}
					onValueChange={handleCountryChange}
					disabled={disabled || readonly}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{countryOptions.map((c) => (
							<SelectItem key={c.code} value={c.code}>
								{c.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Input
					id={id}
					type="tel"
					value={phoneInput}
					onChange={(e) => handlePhoneChange(e.target.value)}
					onBlur={() => onBlur?.(id, value)}
					onFocus={() => onFocus?.(id, value)}
					placeholder={
						placeholder ||
						`Enter phone number (${currentCountry?.callingCode})`
					}
					disabled={disabled}
					readOnly={readonly}
				/>
			</div>
			{error && <p>{error}</p>}
			{!error && currentCountry && (
				<p>
					Format: {currentCountry.callingCode} XXX XXX XXXX
				</p>
			)}
		</div>
	);
};

// ----- TextWidget -----

export const TextWidget: React.FC<WidgetProps> = ({
	id,
	value,
	onChange,
	onBlur,
	onFocus,
	placeholder,
	disabled,
	readonly,
	required,
	schema,
	label,
}) => {
	const isEmail = schema.format === "email";
	const [validity, setValidity] = useState<boolean | null>(null);

	const validateField = useCallback(
		(v: string) => {
			if (!v) {
				setValidity(required ? false : null);
				return;
			}
			if (isEmail) {
				setValidity(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
				return;
			}
			setValidity(v.trim().length > 0);
		},
		[required, isEmail],
	);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		validateField(newValue);
		onChange(newValue);
	};

	useEffect(() => {
		if (value) validateField(value);
	}, [value, validateField]);

	return (
		<div>
			<Label htmlFor={id}>
				{label}
				{required && <span>*</span>}
			</Label>
			<Input
				id={id}
				type={isEmail ? "email" : "text"}
				value={value || ""}
				onChange={handleChange}
				onBlur={() => {
					validateField(value || "");
					onBlur?.(id, value);
				}}
				onFocus={() => onFocus?.(id, value)}
				placeholder={placeholder}
				disabled={disabled}
				readOnly={readonly}
			/>
		</div>
	);
};

// ----- SelectWidget -----

export const SelectWidget: React.FC<WidgetProps> = ({
	id,
	value,
	onChange,
	onBlur,
	onFocus,
	disabled,
	readonly,
	required,
	options,
	label,
	placeholder,
}) => {
	const { enumOptions = [] } = options;

	return (
		<div>
			<Label htmlFor={id}>
				{label}
				{required && <span>*</span>}
			</Label>
			<Select
				value={value || ""}
				onValueChange={(v) => onChange(v === "" ? undefined : v)}
				disabled={disabled || readonly}
			>
				<SelectTrigger id={id}>
					<SelectValue placeholder={placeholder || "Select..."} />
				</SelectTrigger>
				<SelectContent>
					{(enumOptions as Array<{ label: string; value: any }>).map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
};

// ----- Templates -----

export const FieldTemplate: React.FC<FieldTemplateProps> = ({
	children,
	description,
	errors,
	help,
	hidden,
}) => {
	if (hidden) return <div>{children}</div>;

	return (
		<div>
			{children}
			{description && (
				<p>{description}</p>
			)}
			{errors && (
				<p>{errors}</p>
			)}
			{help && (
				<p>{help}</p>
			)}
		</div>
	);
};

export const ObjectFieldTemplate: React.FC<ObjectFieldTemplateProps> = ({
	title,
	description,
	properties,
}) => {
	return (
		<div>
			{title && (
				<h3>{title}</h3>
			)}
			{description && (
				<p>{description}</p>
			)}
			<div>
				{properties.map((prop) => (
					<div key={prop.name}>{prop.content}</div>
				))}
			</div>
		</div>
	);
};

export const SubmitButton: React.FC<SubmitButtonProps> = () => null;

// ----- Schema Conversion Helpers -----

export const convertKratosSchemaToRJSF = (kratosSchema: any) => {
	const schemaObj = kratosSchema as any;
	if (schemaObj?.properties?.traits) {
		return {
			title: "Identity Traits",
			type: "object",
			properties: schemaObj.properties.traits.properties,
			required: schemaObj.properties.traits.required || [],
		};
	}
	return {
		title: "Identity Traits",
		type: "object",
		properties: {},
	};
};

export const createUISchema = (schema: any) => {
	const uiSchema: any = {};
	for (const key of Object.keys(schema.properties || {})) {
		const property = (schema.properties as any)[key];
		if (property.format === "email") {
			uiSchema[key] = { "ui:widget": "email" };
		} else if (property.format === "tel") {
			uiSchema[key] = { "ui:widget": "tel" };
		}
		if (property.type === "object" && property.properties) {
			uiSchema[key] = { "ui:field": "object" };
		}
	}
	return uiSchema;
};
