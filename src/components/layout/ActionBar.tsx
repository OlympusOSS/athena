"use client";

import type { ReactNode } from "react";
import { Button, Icon, cn } from "@olympus/canvas";

export interface ActionBarProps {
	primaryAction?: {
		label: string;
		onClick: () => void;
		icon?: ReactNode;
		loading?: boolean;
		disabled?: boolean;
	};
	secondaryActions?: Array<{
		label: string;
		onClick: () => void;
		icon?: ReactNode;
		variant?: "outline" | "ghost";
		disabled?: boolean;
	}>;
	align?: "left" | "right" | "center" | "space-between";
	spacing?: number;
	className?: string;
}

const alignMap: Record<string, string> = {
	left: "justify-start",
	right: "justify-end",
	center: "justify-center",
	"space-between": "justify-between",
};

export function ActionBar({
	primaryAction,
	secondaryActions = [],
	align = "right",
	className,
}: ActionBarProps) {
	return (
		<div className={cn("flex items-center gap-2", alignMap[align], className)}>
			{secondaryActions.map((action, index) => (
				<Button
					key={action.label}
					onClick={action.onClick}
					disabled={action.disabled}
					variant={action.variant || "outline"}
					size="sm"
				>
					{action.icon && <span className="mr-1">{action.icon}</span>}
					{action.label}
				</Button>
			))}

			{primaryAction && (
				<Button
					onClick={primaryAction.onClick}
					disabled={primaryAction.disabled || primaryAction.loading}
					size="sm"
				>
					{primaryAction.loading ? (
						<Icon name="loading" className="mr-1 h-4 w-4 animate-spin" />
					) : (
						primaryAction.icon && (
							<span className="mr-1">{primaryAction.icon}</span>
						)
					)}
					{primaryAction.label}
				</Button>
			)}
		</div>
	);
}

ActionBar.displayName = "ActionBar";
