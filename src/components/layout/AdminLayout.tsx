"use client";

import { cn } from "@olympusoss/canvas";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AdminLayoutProps {
	children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
	const [sidebarExpanded, setSidebarExpanded] = useState(true);
	const [mobileOpen, setMobileOpen] = useState(false);
	const pathname = usePathname();

	// Close mobile sidebar on route change
	useEffect(() => {
		// Reference pathname so the effect re-runs on navigation
		void pathname;
		setMobileOpen(false);
	}, [pathname]);

	const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);

	return (
		<ProtectedRoute>
			<div className="flex h-screen overflow-hidden bg-background">
				{/* Sidebar — hidden on mobile, visible on md+ */}
				<div className="hidden md:block">
					<Sidebar expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} />
				</div>

				{/* Mobile sidebar overlay */}
				{mobileOpen && (
					<>
						<div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
						<div className="fixed inset-y-0 left-0 z-40 md:hidden">
							<Sidebar expanded onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
						</div>
					</>
				)}

				{/* Main content area */}
				<div className={cn("flex flex-1 flex-col overflow-hidden transition-all duration-300", sidebarExpanded ? "md:ml-60" : "md:ml-14")}>
					{/* Header */}
					<Header onMobileMenuToggle={toggleMobile} />

					{/* Page content */}
					<main className="flex-1 overflow-y-auto styled-scrollbar">
						<div className="p-4 sm:p-6">{children}</div>
					</main>
				</div>
			</div>
		</ProtectedRoute>
	);
}

export default AdminLayout;
