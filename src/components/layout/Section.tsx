"use client";

import { cn } from "@olympusoss/canvas";
import React from "react";

export interface SectionProps extends React.HTMLAttributes<HTMLDivElement> {
	spacing?: number;
	sx?: Record<string, unknown>; // backwards compatibility
}

const spacingMap: Record<number, string> = {
	0: "space-y-0",
	1: "space-y-2",
	2: "space-y-4",
	3: "space-y-6",
	4: "space-y-8",
	5: "space-y-10",
	6: "space-y-12",
};

export const Section = React.forwardRef<HTMLDivElement, SectionProps>(({ spacing = 3, className, ...rest }, ref) => {
	return <div ref={ref} className={cn(spacingMap[spacing] || "space-y-6", className)} {...rest} />;
});

Section.displayName = "Section";
