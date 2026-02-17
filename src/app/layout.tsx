import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import Providers from "@/providers/Providers";
import ThemeRegistry from "@/providers/ThemeRegistry";

const inter = Inter({
	subsets: ["latin"],
	display: "swap",
});

const appInstance = process.env.NEXT_PUBLIC_APP_INSTANCE || "";
const appTitle = appInstance ? `Athena ${appInstance}` : "Athena";

export const metadata: Metadata = {
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

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={inter.className}>
			<body suppressHydrationWarning={true}>
				<AppRouterCacheProvider options={{ enableCssLayer: true }}>
					<ThemeRegistry>
						<Providers>{children}</Providers>
					</ThemeRegistry>
				</AppRouterCacheProvider>
			</body>
		</html>
	);
}
