"use client";

import { cn } from "@olympus/canvas";
import type React from "react";

export interface PageTabsProps {
	tabs: Array<{
		label: string;
		value: string;
		icon?: React.ReactNode;
		badge?: number | string;
	}>;
	value: string;
	onChange: (value: string) => void;
	variant?: "default" | "pills" | "underline";
}

export function PageTabs({ tabs, value, onChange, variant = "default" }: PageTabsProps) {
	if (variant === "pills") {
		return (
			<div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
				{tabs.map((tab) => (
					<button
						key={tab.value}
						type="button"
						onClick={() => onChange(tab.value)}
						className={cn(
							"inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
							value === tab.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
						)}
					>
						{tab.icon && <span className="h-4 w-4">{tab.icon}</span>}
						{tab.label}
						{tab.badge !== undefined && (
							<span
								className={cn(
									"ml-1 rounded-full px-1.5 py-0.5 text-xs font-medium",
									value === tab.value ? "bg-primary/10 text-primary" : "bg-muted-foreground/10 text-muted-foreground",
								)}
							>
								{tab.badge}
							</span>
						)}
					</button>
				))}
			</div>
		);
	}

	if (variant === "underline") {
		return (
			<div className="flex gap-4 border-b border-border">
				{tabs.map((tab) => (
					<button
						key={tab.value}
						type="button"
						onClick={() => onChange(tab.value)}
						className={cn(
							"inline-flex items-center gap-1.5 border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
							value === tab.value
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
						)}
					>
						{tab.icon && <span className="h-4 w-4">{tab.icon}</span>}
						{tab.label}
						{tab.badge !== undefined && (
							<span
								className={cn(
									"ml-1 rounded-full px-1.5 py-0.5 text-xs font-medium",
									value === tab.value ? "bg-primary/10 text-primary" : "bg-muted-foreground/10 text-muted-foreground",
								)}
							>
								{tab.badge}
							</span>
						)}
					</button>
				))}
			</div>
		);
	}

	// default variant
	return (
		<div className="flex flex-wrap gap-1">
			{tabs.map((tab) => (
				<button
					key={tab.value}
					type="button"
					onClick={() => onChange(tab.value)}
					className={cn(
						"inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
						value === tab.value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
					)}
				>
					{tab.icon && <span className="h-4 w-4">{tab.icon}</span>}
					{tab.label}
					{tab.badge !== undefined && (
						<span
							className={cn(
								"ml-1 rounded-full px-1.5 py-0.5 text-xs font-medium",
								value === tab.value ? "bg-primary/10 text-primary" : "bg-muted-foreground/10 text-muted-foreground",
							)}
						>
							{tab.badge}
						</span>
					)}
				</button>
			))}
		</div>
	);
}

PageTabs.displayName = "PageTabs";
