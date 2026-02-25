"use client";

import { Badge, Button, Icon, Input } from "@olympusoss/canvas";
import type React from "react";

export interface SearchBarProps {
	value: string;
	onChange: (value: string) => void;
	onSearch?: () => void;
	placeholder?: string;
	filters?: Array<{
		label: string;
		value: string;
		icon?: React.ReactNode;
	}>;
	onFilterChange?: (filter: string) => void;
	activeFilter?: string;
	loading?: boolean;
}

export function SearchBar({
	value,
	onChange,
	onSearch,
	placeholder = "Search...",
	filters,
	onFilterChange,
	activeFilter,
	loading = false,
}: SearchBarProps) {
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
		if (e.key === "Enter" && onSearch) {
			onSearch();
		}
	};

	const handleClear = (): void => {
		onChange("");
		if (onSearch) {
			onSearch();
		}
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		onChange(e.target.value);
	};

	const handleFilterClick = (filterValue: string): void => {
		onFilterChange?.(filterValue);
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<div className="relative flex flex-1 items-center">
					<Icon name="search" className="absolute left-3 h-4 w-4 text-muted-foreground" />
					<Input value={value} onChange={handleChange} onKeyDown={handleKeyDown} placeholder={placeholder} className="pl-9 pr-8" />
					<div className="absolute right-2 flex items-center">
						{loading ? (
							<Icon name="loading" className="h-4 w-4 animate-spin text-muted-foreground" />
						) : value ? (
							<Button variant="ghost" size="icon" onClick={handleClear} aria-label="Clear search" type="button" className="h-6 w-6">
								<Icon name="close" className="h-3.5 w-3.5" />
							</Button>
						) : null}
					</div>
				</div>
			</div>

			{filters && filters.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{filters.map((filter) => (
						<Badge
							key={filter.value}
							variant={activeFilter === filter.value ? "default" : "outline"}
							onClick={() => handleFilterClick(filter.value)}
							className="cursor-pointer"
						>
							{filter.icon && <span className="mr-1">{filter.icon}</span>}
							{filter.label}
						</Badge>
					))}
				</div>
			)}
		</div>
	);
}

SearchBar.displayName = "SearchBar";
