import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	reactStrictMode: true,
	transpilePackages: ["@olympus/canvas"],
	images: {
		domains: ["localhost", "kratos.local"],
	},
};

export default nextConfig;
