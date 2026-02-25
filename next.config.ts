import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	reactStrictMode: true,
	transpilePackages: ["@olympusoss/canvas"],
	images: {
		domains: ["localhost", "kratos.local"],
	},
};

export default nextConfig;
