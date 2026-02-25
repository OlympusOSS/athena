import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@olympusoss/canvas";
import type { FieldTemplateProps, ObjectFieldTemplateProps, SubmitButtonProps, WidgetProps } from "@rjsf/utils";
import parsePhoneNumber, { type CountryCode, getCountries, getCountryCallingCode, isValidPhoneNumber } from "libphonenumber-js";
import React, { useState } from "react";

// Memoize country options for autocomplete to avoid recalculation
export const getCountryOptions = () => {
	return getCountries()
		.map((countryCode) => {
			const callingCode = getCountryCallingCode(countryCode);
			return {
				code: countryCode,
				name: new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) || countryCode,
				callingCode: `+${callingCode}`,
				label: `${new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode)} (+${callingCode})`,
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
};

// Custom tel widget component with libphonenumber-js integration
export const TelWidget: React.FC<WidgetProps> = ({ id, value, onChange, onBlur, onFocus, placeholder, disabled, readonly, required, label }) => {
	const [selectedCountry, setSelectedCountry] = useState<CountryCode>("US");
	const [phoneInput, setPhoneInput] = useState("");
	const [error, setError] = useState<string>("");
	const [isValid, setIsValid] = useState<boolean | null>(null);
	const [countrySearch, _setCountrySearch] = useState("");

	const countryOptions = getCountryOptions();

	// Initialize state from value
	React.useEffect(() => {
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

	const handlePhoneChange = (newPhoneInput: string) => {
		setPhoneInput(newPhoneInput);
		setError("");

		if (!newPhoneInput.trim()) {
			onChange("");
			return;
		}

		try {
			// Try to parse with selected country
			const phoneNumber = parsePhoneNumber(newPhoneInput, selectedCountry);

			if (phoneNumber?.isValid()) {
				// Format as international number
				const formatted = phoneNumber.formatInternational();
				onChange(formatted);
				setError("");
				setIsValid(true);
			} else {
				// Also check with isValidPhoneNumber for additional validation
				const valid = isValidPhoneNumber(newPhoneInput, selectedCountry);
				onChange(newPhoneInput);

				if (newPhoneInput.length > 3 && !valid) {
					setError("Invalid phone number format");
					setIsValid(false);
				} else if (newPhoneInput.length <= 3) {
					setIsValid(null);
				}
			}
		} catch (_err) {
			// Final validation check for any parsing errors
			const valid = isValidPhoneNumber(newPhoneInput, selectedCountry);
			onChange(newPhoneInput);

			if (newPhoneInput.length > 3 && !valid) {
				setError("Invalid phone number format");
				setIsValid(false);
			} else if (newPhoneInput.length <= 3) {
				setIsValid(null);
			}
		}
	};

	const handleCountryChange = (newCountry: CountryCode) => {
		setSelectedCountry(newCountry);

		if (phoneInput) {
			try {
				const phoneNumber = parsePhoneNumber(phoneInput, newCountry);
				if (phoneNumber?.isValid()) {
					const formatted = phoneNumber.formatInternational();
					onChange(formatted);
					setError("");
				} else {
					// Validate with the new country
					const valid = isValidPhoneNumber(phoneInput, newCountry);
					if (!valid && phoneInput.length > 3) {
						setError("Invalid phone number format for selected country");
					} else {
						setError("");
					}
				}
			} catch {
				// Validate even if parsing fails
				const valid = isValidPhoneNumber(phoneInput, newCountry);
				if (!valid && phoneInput.length > 3) {
					setError("Invalid phone number format for selected country");
				} else {
					setError("");
				}
			}
		}
	};

	const currentCountry = countryOptions.find((c) => c.code === selectedCountry);

	const _getBorderClass = () => {
		if (isValid === true) return "border-emerald-500 focus-visible:ring-emerald-500";
		if (isValid === false) return "border-red-500 focus-visible:ring-red-500";
		return "";
	};

	// Filter countries for the searchable select
	const _filteredCountries = countrySearch
		? countryOptions.filter((c) => c.label.toLowerCase().includes(countrySearch.toLowerCase()))
		: countryOptions;

	return (
		<div>
			<div>
				<Label>Country</Label>
				<Select value={selectedCountry} onValueChange={(val: string) => handleCountryChange(val as CountryCode)} disabled={disabled || readonly}>
					<SelectTrigger>
						<SelectValue placeholder="Select country" />
					</SelectTrigger>
					<SelectContent>
						{countryOptions.map((option) => (
							<SelectItem key={option.code} value={option.code}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div>
				<Label htmlFor={id}>
					{required ? `${label || "Phone Number"} ` : label || "Phone Number"}
					{required && <span>*</span>}
				</Label>
				<Input
					id={id}
					type="tel"
					value={phoneInput}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) => handlePhoneChange(e.target.value)}
					onBlur={onBlur ? () => onBlur(id, value) : undefined}
					onFocus={onFocus ? () => onFocus(id, value) : undefined}
					placeholder={placeholder || `Enter phone number (${currentCountry?.callingCode})`}
					disabled={disabled}
					readOnly={readonly}
				/>
				{error ? <p>{error}</p> : currentCountry && <p>Format: {currentCountry.callingCode} XXX XXX XXXX</p>}
			</div>
		</div>
	);
};

// Custom TextWidget with Tailwind styling
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
	const [isValid, setIsValid] = React.useState<boolean | null>(null);

	const validateField = React.useCallback(
		(fieldValue: string) => {
			if (!fieldValue) {
				if (required) {
					setIsValid(false);
					return false;
				} else {
					setIsValid(null);
					return true;
				}
			}

			// Email validation
			if (isEmail) {
				const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
				const valid = emailRegex.test(fieldValue);
				setIsValid(valid);
				return valid;
			}

			// Basic validation for non-empty required fields
			if (fieldValue.trim().length > 0) {
				setIsValid(true);
				return true;
			}

			setIsValid(false);
			return false;
		},
		[required, isEmail],
	);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		validateField(newValue);
		onChange(newValue);
	};

	const handleBlurEvent = () => {
		validateField(value || "");
		if (onBlur) onBlur(id, value);
	};

	React.useEffect(() => {
		if (value) {
			validateField(value);
		}
	}, [value, validateField]);

	const _getBorderClass = () => {
		if (isValid === true) return "border-emerald-500 focus-visible:ring-emerald-500";
		if (isValid === false) return "border-red-500 focus-visible:ring-red-500";
		return "";
	};

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
				onBlur={handleBlurEvent}
				onFocus={onFocus ? () => onFocus(id, value) : undefined}
				placeholder={placeholder}
				disabled={disabled}
				readOnly={readonly}
			/>
		</div>
	);
};

// Custom SelectWidget with shadcn Select for enum fields
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
	const [isValid, setIsValid] = React.useState<boolean | null>(null);

	React.useEffect(() => {
		if (value) {
			setIsValid(true);
		} else if (required) {
			setIsValid(false);
		} else {
			setIsValid(null);
		}
	}, [value, required]);

	const handleChange = (newValue: string) => {
		onChange(newValue === "" ? undefined : newValue);
		if (newValue) {
			setIsValid(true);
		} else if (required) {
			setIsValid(false);
		} else {
			setIsValid(null);
		}
	};

	const _getBorderClass = () => {
		if (isValid === true) return "border-emerald-500";
		if (isValid === false) return "border-red-500";
		return "";
	};

	return (
		<div>
			<Label htmlFor={id}>
				{label}
				{required && <span>*</span>}
			</Label>
			<Select value={value || ""} onValueChange={handleChange} disabled={disabled || readonly}>
				<SelectTrigger id={id}>
					<SelectValue placeholder={placeholder || "Select..."} />
				</SelectTrigger>
				<SelectContent>
					{(enumOptions as Array<{ value: string; label: string }>).map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
};

// Custom Field Template
export const FieldTemplate: React.FC<FieldTemplateProps> = ({ children, description, errors, help, hidden }) => {
	if (hidden) {
		return <div>{children}</div>;
	}

	return (
		<div>
			{children}
			{description && <span>{description}</span>}
			{errors && <span>{errors}</span>}
			{help && <span>{help}</span>}
		</div>
	);
};

// Custom Object Field Template for nested objects
export const ObjectFieldTemplate: React.FC<ObjectFieldTemplateProps> = ({ title, description, properties }) => {
	return (
		<div>
			{title && <h3>{title}</h3>}
			{description && <p>{description}</p>}
			<div>
				{properties.map((prop) => (
					<div key={prop.name}>{prop.content}</div>
				))}
			</div>
		</div>
	);
};

// Custom Submit Button Template (hidden since we use our own buttons)
export const SubmitButton: React.FC<SubmitButtonProps> = () => {
	return null; // We handle submit with our own buttons
};

// Helper to convert Kratos schema to RJSF schema
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

// Create UI Schema for better form layout
export const createUISchema = (schema: Record<string, unknown>) => {
	const uiSchema: Record<string, unknown> = {};
	const schemaProperties = (schema.properties || {}) as Record<string, Record<string, unknown>>;

	// Customize specific field types
	Object.keys(schemaProperties).forEach((key) => {
		const property = schemaProperties[key];

		if (property.format === "email") {
			uiSchema[key] = {
				"ui:widget": "email",
			};
		} else if (property.format === "tel") {
			uiSchema[key] = {
				"ui:widget": "tel",
			};
		}

		// Handle nested objects (like name.first, name.last)
		if (property.type === "object" && property.properties) {
			uiSchema[key] = {
				"ui:field": "object",
			};
		}
	});

	return uiSchema;
};
