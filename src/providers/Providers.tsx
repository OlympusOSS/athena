"use client";

import type { ReactNode } from "react";
import { SettingsInitializer } from "@/components/SettingsInitializer";
import { AuthProvider } from "./AuthProvider";
import { QueryProvider } from "./QueryProvider";
import { ThemeProvider } from "./ThemeProvider";

interface ProvidersProps {
	children: ReactNode;
}

/**
 * Combines all application providers in the correct order
 */
export default function Providers({ children }: ProvidersProps) {
	return (
		<QueryProvider>
			<ThemeProvider>
				<AuthProvider>
					<SettingsInitializer />
					{children}
				</AuthProvider>
			</ThemeProvider>
		</QueryProvider>
	);
}
