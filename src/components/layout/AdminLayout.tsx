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
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const _pathname = usePathname();

	return (
		<ProtectedRoute>
			<div className="flex h-screen overflow-hidden bg-background">
				{/* Sidebar */}
				<Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

				{/* Main content area */}
				<div className={cn("flex flex-1 flex-col overflow-hidden transition-all duration-300", sidebarOpen ? "md:ml-64" : "ml-0")}>
					{/* Header */}
					<Header sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

					{/* Page content */}
					<main className="flex-1 overflow-y-auto">
						<div className="p-6">{children}</div>
					</main>
				</div>

				{/* Mobile overlay */}
				{sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />}
			</div>
		</ProtectedRoute>
	);
}

export default AdminLayout;
