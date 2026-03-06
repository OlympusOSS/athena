"use client";

import { cn } from "@olympusoss/canvas";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AdminLayoutProps {
	children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
	const [sidebarExpanded, setSidebarExpanded] = useState(true);
	const _pathname = usePathname();

	return (
		<ProtectedRoute>
			<div className="flex h-screen overflow-hidden bg-background">
				{/* Sidebar — always visible, toggles between expanded (w-60) and collapsed (w-14) */}
				<Sidebar expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} />

				{/* Main content area */}
				<div className={cn("flex flex-1 flex-col overflow-hidden transition-all duration-300", sidebarExpanded ? "md:ml-60" : "md:ml-14")}>
					{/* Header */}
					<Header />

					{/* Page content */}
					<main className="flex-1 overflow-y-auto styled-scrollbar">
						<div className="p-6">{children}</div>
					</main>
				</div>
			</div>
		</ProtectedRoute>
	);
}

export default AdminLayout;
