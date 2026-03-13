import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

const { version } = JSON.parse(readFileSync("./package.json", "utf8"));

const nextConfig: NextConfig = {
	output: "standalone",
	reactStrictMode: true,
	transpilePackages: ["@olympusoss/canvas", "@olympusoss/sdk"],
	env: {
		APP_VERSION: version,
	},
	images: {
		domains: ["localhost", "kratos.local"],
	},
};

export default nextConfig;
