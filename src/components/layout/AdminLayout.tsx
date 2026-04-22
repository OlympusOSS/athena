"use client";

import { AdminShell } from "@olympusoss/canvas";
import type { ReactNode } from "react";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AdminLayoutProps {
	children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
	return (
		<ProtectedRoute>
			<AdminShell
				sidebar={({ expanded, setExpanded, closeMobile }) => (
					<Sidebar expanded={expanded} onToggle={() => setExpanded(!expanded)} onNavigate={closeMobile} />
				)}
				header={({ onMobileMenuToggle }) => <Header onMobileMenuToggle={onMobileMenuToggle} />}
			>
				{children}
			</AdminShell>
		</ProtectedRoute>
	);
}

export default AdminLayout;
