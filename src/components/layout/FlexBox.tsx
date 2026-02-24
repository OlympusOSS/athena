"use client";

import React from "react";
import { cn } from "@olympus/canvas";

export interface FlexBoxProps extends React.HTMLAttributes<HTMLDivElement> {
	direction?: "row" | "column";
	align?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
	justify?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around" | "space-evenly";
	gap?: number | string;
	wrap?: boolean;
	sx?: Record<string, unknown>; // backwards compatibility — ignore MUI sx
}

const directionMap: Record<string, string> = {
	row: "flex-row",
	column: "flex-col",
};

const alignMap: Record<string, string> = {
	"flex-start": "items-start",
	center: "items-center",
	"flex-end": "items-end",
	stretch: "items-stretch",
	baseline: "items-baseline",
};

const justifyMap: Record<string, string> = {
	"flex-start": "justify-start",
	center: "justify-center",
	"flex-end": "justify-end",
	"space-between": "justify-between",
	"space-around": "justify-around",
	"space-evenly": "justify-evenly",
};

const gapMap: Record<number, string> = {
	0: "gap-0",
	1: "gap-2",
	2: "gap-4",
	3: "gap-6",
	4: "gap-8",
	5: "gap-10",
	6: "gap-12",
};

export const FlexBox = React.forwardRef<HTMLDivElement, FlexBoxProps>(
	(
		{
			direction = "row",
			align = "flex-start",
			justify = "flex-start",
			gap,
			wrap = false,
			className,
			style,
			...rest
		},
		ref,
	) => {
		const gapClass = typeof gap === "number" ? gapMap[gap] || "" : "";
		const gapStyle = typeof gap === "string" ? { gap } : {};

		return (
			<div
				ref={ref}
				className={cn(
					"flex",
					directionMap[direction],
					alignMap[align],
					justifyMap[justify],
					gapClass,
					wrap && "flex-wrap",
					className,
				)}
				style={{ ...gapStyle, ...style }}
				{...rest}
			/>
		);
	},
);

FlexBox.displayName = "FlexBox";
