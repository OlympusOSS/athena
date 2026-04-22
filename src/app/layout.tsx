/**
 * SECURITY REQUIREMENT — SR-1 (athena#73 Security Review):
 *
 * If any error-tracking or observability SDK (Sentry, Datadog, OpenTelemetry with log
 * export, etc.) is added to Athena, the following fields MUST be in its scrub/deny list
 * before the SDK is enabled on ANY environment:
 *
 *   - client_secret
 *   - client_secret_expires_at
 *   - any field matching *_secret pattern
 *
 * This requirement also applies if a structured logging library (pino, winston) is added.
 *
 * This is a STANDING security requirement — it survives code changes, file renames, and
 * architectural refactors. Any PR that adds an observability or logging dependency to
 * Athena must reference this requirement and confirm compliance.
 *
 * Origin: athena#73 (Next.js Log Sanitization for client_secret)
 * Enforced by: CIAM Security Expert
 * Gate: athena#50 (M2M OAuth2) must not open until athena#73 is Done
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "@/styles/globals.css";
import Providers from "@/providers/Providers";

const inter = Inter({
	subsets: ["latin"],
	display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
	const appInstance = process.env.APP_INSTANCE || process.env.NEXT_PUBLIC_APP_INSTANCE || "";
	const appTitle = appInstance ? `Olympus ${appInstance} Admin` : "Olympus Admin";

	return {
		title: appTitle,
		description: "Admin interface for Ory identity services",
		icons: {
			icon: [
				{ url: "/favicon.svg", type: "image/svg+xml" },
				{ url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
				{ url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
			],
			apple: { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
			other: [{ rel: "icon", url: "/favicon.ico" }],
		},
	};
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	// Read the CSP nonce from middleware (set via x-nonce request header).
	// Next.js automatically applies this nonce to its generated inline scripts
	// when the root layout reads headers() as an async Server Component.
	const nonce = (await headers()).get("x-nonce") ?? "";

	return (
		<html lang="en" className={inter.className} suppressHydrationWarning>
			<body className="min-h-screen bg-background font-sans antialiased" nonce={nonce}>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
