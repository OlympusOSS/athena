import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OAuth2ClientForm } from "@/features/oauth2-clients/components/OAuth2ClientForm";
import type { OAuth2ClientFormData } from "@/features/oauth2-clients/types";

import "./snapshot-setup";

describe("OAuth2ClientForm", () => {
	it("matches snapshot", () => {
		const initialData: OAuth2ClientFormData = {
			client_name: "",
			owner: "",
			client_uri: "",
			logo_uri: "",
			grant_types: [],
			response_types: [],
			scope: "",
			subject_type: "public",
			token_endpoint_auth_method: "client_secret_basic",
			userinfo_signed_response_alg: "",
			policy_uri: "",
			tos_uri: "",
			redirect_uris: [],
			contacts: [],
			audience: [],
		};
		const { container } = render(<OAuth2ClientForm initialData={initialData} onSubmit={() => {}} />);
		expect(container).toMatchSnapshot();
	});
});
