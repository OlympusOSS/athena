"use client";

import { cn, Icon } from "@olympusoss/canvas";
import Link from "next/link";
import type { ReactNode } from "react";

export interface PageHeaderProps {
	title: string | ReactNode;
	subtitle?: string | ReactNode;
	icon?: ReactNode;
	actions?: ReactNode;
	breadcrumbs?: Array<{ label: string; href?: string }>;
	className?: string;
}

export function PageHeader({ title, subtitle, icon, actions, breadcrumbs, className }: PageHeaderProps) {
	return (
		<div className={cn("mb-6 flex items-start justify-between", className)}>
			<div className="space-y-1">
				{breadcrumbs && breadcrumbs.length > 0 && (
					<div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
						{breadcrumbs.map((crumb, index) => (
							<span key={crumb.label} className="flex items-center gap-1">
								{crumb.href ? (
									<Link href={crumb.href} className="hover:text-foreground transition-colors">
										{crumb.label}
									</Link>
								) : (
									<span className="text-foreground">{crumb.label}</span>
								)}
								{index < breadcrumbs.length - 1 && <Icon name="chevron-right" className="h-3.5 w-3.5" />}
							</span>
						))}
					</div>
				)}
				{typeof title === "string" ? <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1> : title}
				{subtitle && <div>{typeof subtitle === "string" ? <p className="text-sm text-muted-foreground">{subtitle}</p> : subtitle}</div>}
			</div>
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</div>
	);
}

PageHeader.displayName = "PageHeader";
