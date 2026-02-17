import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Expose server-side env vars to the Edge Runtime proxy.
	// Without this, process.env in proxy.ts only sees NEXT_PUBLIC_* vars,
	// causing both CIAM and IAM Athena to fall back to the same defaults.
	env: {
		KRATOS_PUBLIC_URL: process.env.KRATOS_PUBLIC_URL,
		KRATOS_ADMIN_URL: process.env.KRATOS_ADMIN_URL,
		KRATOS_API_KEY: process.env.KRATOS_API_KEY,
		HYDRA_PUBLIC_URL: process.env.HYDRA_PUBLIC_URL,
		HYDRA_ADMIN_URL: process.env.HYDRA_ADMIN_URL,
		HYDRA_API_KEY: process.env.HYDRA_API_KEY,
		IAM_KRATOS_PUBLIC_URL: process.env.IAM_KRATOS_PUBLIC_URL,
		IAM_KRATOS_ADMIN_URL: process.env.IAM_KRATOS_ADMIN_URL,
	},
};

export default nextConfig;
