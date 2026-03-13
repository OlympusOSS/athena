import type { NextConfig } from "next";
import { readFileSync } from "fs";

const { version } = JSON.parse(readFileSync("./package.json", "utf8"));

const nextConfig: NextConfig = {
	output: "standalone",
	reactStrictMode: true,
	transpilePackages: ["@olympusoss/canvas"],
	env: {
		APP_VERSION: version,
	},
	images: {
		domains: ["localhost", "kratos.local"],
	},
};

export default nextConfig;
