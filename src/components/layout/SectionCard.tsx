"use client";

import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle, cn, Icon } from "@olympusoss/canvas";
import type { ReactNode } from "react";

export interface SectionCardProps {
	title?: string | ReactNode;
	subtitle?: string;
	headerActions?: ReactNode;
	children: ReactNode;
	loading?: boolean;
	error?: string | boolean;
	emptyMessage?: string;
	padding?: boolean;
	className?: string;
	variant?: "bordered" | "gradient" | "outlined";
	sx?: Record<string, unknown>; // backwards compatibility — ignore MUI sx
}

export function SectionCard({
	title,
	subtitle,
	headerActions,
	children,
	loading = false,
	error,
	emptyMessage,
	padding = true,
	className,
}: SectionCardProps) {
	return (
		<Card className={className}>
			{(title || subtitle || headerActions) && (
				<CardHeader>
					<div className="flex flex-1 flex-col gap-1">
						{title && <>{typeof title === "string" ? <CardTitle>{title}</CardTitle> : title}</>}
						{subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
					</div>
					{headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
				</CardHeader>
			)}

			<CardContent className={cn(!padding && "p-0")}>
				{loading ? (
					<div className="flex items-center justify-center py-8">
						<Icon name="loading" className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : error ? (
					<Alert variant="destructive">
						<Icon name="error" className="h-4 w-4" />
						<AlertDescription>{typeof error === "string" ? error : "An error occurred"}</AlertDescription>
					</Alert>
				) : emptyMessage && !children ? (
					<div className="flex items-center justify-center py-8 text-center">
						<p className="text-sm text-muted-foreground">{emptyMessage}</p>
					</div>
				) : (
					children
				)}
			</CardContent>
		</Card>
	);
}

SectionCard.displayName = "SectionCard";
