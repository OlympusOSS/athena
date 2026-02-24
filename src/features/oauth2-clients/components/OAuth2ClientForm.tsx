"use client";

import { Badge, Button, Icon, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@olympus/canvas";
import { useState } from "react";
import type { OAuth2ClientFormData, OAuth2ClientFormErrors } from "../types";
import { OAUTH2_GRANT_TYPES, OAUTH2_RESPONSE_TYPES, OAUTH2_SUBJECT_TYPES, OAUTH2_TOKEN_ENDPOINT_AUTH_METHODS } from "../types";
import { validateOAuth2ClientForm } from "../utils";

interface OAuth2ClientFormProps {
	initialData: OAuth2ClientFormData;
	onSubmit: (data: OAuth2ClientFormData) => void | Promise<void>;
	submitButtonLabel?: string;
	isSubmitting?: boolean;
	error?: Error | null;
	onCancel?: () => void;
}

export function OAuth2ClientForm({
	initialData,
	onSubmit,
	submitButtonLabel = "Create Client",
	isSubmitting = false,
	error,
	onCancel,
}: OAuth2ClientFormProps) {
	const [formData, setFormData] = useState<OAuth2ClientFormData>(initialData);
	const [errors, setErrors] = useState<OAuth2ClientFormErrors>({});
	const [newRedirectUri, setNewRedirectUri] = useState("");
	const [newContact, setNewContact] = useState("");
	const [newAudience, setNewAudience] = useState("");

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		// Validate form
		const validationErrors = validateOAuth2ClientForm(formData);
		setErrors(validationErrors);

		if (Object.keys(validationErrors).length > 0) {
			return;
		}

		await onSubmit(formData);
	};

	const handleChange = (field: keyof OAuth2ClientFormData) => (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value;
		setFormData((prev) => ({ ...prev, [field]: value }));

		// Clear error for this field
		if (errors[field as keyof OAuth2ClientFormErrors]) {
			setErrors((prev) => ({ ...prev, [field]: undefined }));
		}
	};

	const handleSelectChange = (field: keyof OAuth2ClientFormData) => (value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));

		if (errors[field as keyof OAuth2ClientFormErrors]) {
			setErrors((prev) => ({ ...prev, [field]: undefined }));
		}
	};

	const handleArrayChange = (field: keyof OAuth2ClientFormData, newValue: string[]) => {
		setFormData((prev) => ({ ...prev, [field]: newValue }));
		if (errors[field as keyof OAuth2ClientFormErrors]) {
			setErrors((prev) => ({ ...prev, [field]: undefined }));
		}
	};

	const toggleArrayItem = (field: keyof OAuth2ClientFormData, item: string) => {
		const currentValues = (formData[field] as string[]) || [];
		const newValues = currentValues.includes(item) ? currentValues.filter((v) => v !== item) : [...currentValues, item];
		handleArrayChange(field, newValues);
	};

	const addRedirectUri = () => {
		if (!newRedirectUri.trim()) return;
		handleArrayChange("redirect_uris", [...formData.redirect_uris, newRedirectUri.trim()]);
		setNewRedirectUri("");
	};

	const removeRedirectUri = (index: number) => {
		const updated = formData.redirect_uris.filter((_, i) => i !== index);
		handleArrayChange("redirect_uris", updated);
	};

	const addContact = () => {
		if (!newContact.trim()) return;
		handleArrayChange("contacts", [...(formData.contacts || []), newContact.trim()]);
		setNewContact("");
	};

	const removeContact = (index: number) => {
		const updated = (formData.contacts || []).filter((_, i) => i !== index);
		handleArrayChange("contacts", updated);
	};

	const addAudience = () => {
		if (!newAudience.trim()) return;
		handleArrayChange("audience", [...(formData.audience || []), newAudience.trim()]);
		setNewAudience("");
	};

	const removeAudience = (index: number) => {
		const updated = (formData.audience || []).filter((_, i) => i !== index);
		handleArrayChange("audience", updated);
	};

	return (
		<form onSubmit={handleSubmit}>
			<div>
				{/* Basic Information */}
				<div>
					<h3>Basic Information</h3>
					<div>
						<div>
							<Label htmlFor="client_name">
								Client Name <span>*</span>
							</Label>
							<Input id="client_name" value={formData.client_name} onChange={handleChange("client_name")} />
							{errors.client_name && <p>{errors.client_name}</p>}
						</div>
						<div>
							<Label htmlFor="owner">Owner</Label>
							<Input id="owner" value={formData.owner} onChange={handleChange("owner")} />
							<p>Optional: Organization or user that owns this client</p>
						</div>
						<div>
							<Label htmlFor="client_uri">Client URI</Label>
							<Input id="client_uri" value={formData.client_uri} onChange={handleChange("client_uri")} />
							<p>{errors.client_uri ? <span>{errors.client_uri}</span> : "URL of the client's homepage"}</p>
						</div>
						<div>
							<Label htmlFor="logo_uri">Logo URI</Label>
							<Input id="logo_uri" value={formData.logo_uri} onChange={handleChange("logo_uri")} />
							<p>{errors.logo_uri ? <span>{errors.logo_uri}</span> : "URL of the client's logo image"}</p>
						</div>
					</div>
				</div>

				{/* OAuth2 Configuration */}
				<div>
					<h3>OAuth2 Configuration</h3>
					<div>
						{/* Grant Types - multi-select as toggleable badges */}
						<div>
							<Label>Grant Types</Label>
							<div>
								{OAUTH2_GRANT_TYPES.map((grantType) => {
									const _isSelected = formData.grant_types.includes(grantType);
									return (
										<button key={grantType} type="button" onClick={() => toggleArrayItem("grant_types", grantType)}>
											{grantType.replace(/_/g, " ")}
										</button>
									);
								})}
							</div>
							{errors.grant_types && <p>{errors.grant_types}</p>}
						</div>

						{/* Response Types - multi-select as toggleable badges */}
						<div>
							<Label>Response Types</Label>
							<div>
								{OAUTH2_RESPONSE_TYPES.map((responseType) => {
									const _isSelected = formData.response_types.includes(responseType);
									return (
										<button key={responseType} type="button" onClick={() => toggleArrayItem("response_types", responseType)}>
											{responseType}
										</button>
									);
								})}
							</div>
							{errors.response_types && <p>{errors.response_types}</p>}
						</div>

						<div>
							<Label htmlFor="scope">Scope</Label>
							<Input id="scope" value={formData.scope} onChange={handleChange("scope")} placeholder="openid profile email" />
							<p>Space-separated list of scopes</p>
						</div>

						<div>
							<Label htmlFor="subject_type">Subject Type</Label>
							<Select value={formData.subject_type} onValueChange={handleSelectChange("subject_type")}>
								<SelectTrigger>
									<SelectValue placeholder="Select subject type" />
								</SelectTrigger>
								<SelectContent>
									{OAUTH2_SUBJECT_TYPES.map((type) => (
										<SelectItem key={type} value={type}>
											{type}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				{/* Redirect URIs */}
				<div>
					<h3>Redirect URIs</h3>
					<div>
						<Input
							value={newRedirectUri}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRedirectUri(e.target.value)}
							placeholder="https://example.com/callback"
							onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
								if (e.key === "Enter") {
									e.preventDefault();
									addRedirectUri();
								}
							}}
						/>
						<Button type="button" variant="outline" onClick={addRedirectUri}>
							<Icon name="add" />
							Add
						</Button>
					</div>
					{errors.redirect_uris && <div>{errors.redirect_uris}</div>}
					<div>
						{formData.redirect_uris.map((uri, index) => (
							<Badge key={index} variant="secondary">
								{uri}
								<button type="button" onClick={() => removeRedirectUri(index)}>
									<Icon name="close" />
								</button>
							</Badge>
						))}
					</div>
				</div>

				{/* Advanced Configuration */}
				<div>
					<h3>Advanced Configuration</h3>
					<div>
						<div>
							<Label htmlFor="token_endpoint_auth_method">Token Endpoint Auth Method</Label>
							<Select value={formData.token_endpoint_auth_method} onValueChange={handleSelectChange("token_endpoint_auth_method")}>
								<SelectTrigger>
									<SelectValue placeholder="Select auth method" />
								</SelectTrigger>
								<SelectContent>
									{OAUTH2_TOKEN_ENDPOINT_AUTH_METHODS.map((method) => (
										<SelectItem key={method} value={method}>
											{method.replace(/_/g, " ")}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<Label htmlFor="userinfo_signed_response_alg">UserInfo Signed Response Algorithm</Label>
							<Input
								id="userinfo_signed_response_alg"
								value={formData.userinfo_signed_response_alg}
								onChange={handleChange("userinfo_signed_response_alg")}
								placeholder="RS256"
							/>
						</div>
						<div>
							<Label htmlFor="policy_uri">Policy URI</Label>
							<Input id="policy_uri" value={formData.policy_uri} onChange={handleChange("policy_uri")} />
							<p>{errors.policy_uri ? <span>{errors.policy_uri}</span> : "URL of privacy policy"}</p>
						</div>
						<div>
							<Label htmlFor="tos_uri">Terms of Service URI</Label>
							<Input id="tos_uri" value={formData.tos_uri} onChange={handleChange("tos_uri")} />
							<p>{errors.tos_uri ? <span>{errors.tos_uri}</span> : "URL of terms of service"}</p>
						</div>
					</div>
				</div>

				{/* Contacts and Audience */}
				<div>
					<div>
						<h3>Contact Information</h3>
						<div>
							<Input
								value={newContact}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewContact(e.target.value)}
								placeholder="admin@example.com"
								onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
									if (e.key === "Enter") {
										e.preventDefault();
										addContact();
									}
								}}
							/>
							<Button type="button" variant="outline" onClick={addContact}>
								<Icon name="add" />
								Add
							</Button>
						</div>
						<div>
							{(formData.contacts || []).map((contact, index) => (
								<Badge key={index} variant="secondary">
									{contact}
									<button type="button" onClick={() => removeContact(index)}>
										<Icon name="close" />
									</button>
								</Badge>
							))}
						</div>
					</div>

					<div>
						<h3>Audience</h3>
						<div>
							<Input
								value={newAudience}
								onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAudience(e.target.value)}
								placeholder="https://api.example.com"
								onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
									if (e.key === "Enter") {
										e.preventDefault();
										addAudience();
									}
								}}
							/>
							<Button type="button" variant="outline" onClick={addAudience}>
								<Icon name="add" />
								Add
							</Button>
						</div>
						<div>
							{(formData.audience || []).map((aud, index) => (
								<Badge key={index} variant="secondary">
									{aud}
									<button type="button" onClick={() => removeAudience(index)}>
										<Icon name="close" />
									</button>
								</Badge>
							))}
						</div>
					</div>
				</div>

				{/* Submit Actions */}
				<div>
					{onCancel && (
						<Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
							Cancel
						</Button>
					)}
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? "Submitting..." : submitButtonLabel}
					</Button>
				</div>
			</div>

			{/* Error Display */}
			{error && (
				<div>
					<Icon name="error" />
					{error.message}
				</div>
			)}
		</form>
	);
}
