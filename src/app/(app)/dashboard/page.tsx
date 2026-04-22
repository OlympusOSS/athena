"use client";

import { Card, CardContent, CardHeader, CardTitle, Icon } from "@olympusoss/canvas";
import { ProtectedPage } from "@/components/layout";

export default function DashboardPage() {
	return (
		<ProtectedPage>
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
					<p className="text-muted-foreground">Overview of your identity platform.</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Icon name="LayoutDashboard" size={20} />
							Dashboard
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">Dashboard widgets are being rebuilt with the new design system. Check back soon.</p>
					</CardContent>
				</Card>
			</div>
		</ProtectedPage>
	);
}
