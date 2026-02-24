"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Icon, type IconName, ScrollArea, Separator, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn } from "@olympus/canvas";
import { UserRole, useLogout, useUser } from "@/features/auth";
import { useHydraEnabled } from "@/features/settings/hooks/useSettings";
import { APP_TITLE } from "@/lib/constants";

interface NavItem {
	title: string;
	path: string;
	icon: IconName;
	requiredRole?: UserRole;
}

const mainNavItems: NavItem[] = [
	{
		title: "Dashboard",
		path: "/dashboard",
		icon: "dashboard",
		requiredRole: UserRole.VIEWER,
	},
	{
		title: "Identities",
		path: "/identities",
		icon: "users",
		requiredRole: UserRole.ADMIN,
	},
	{
		title: "Sessions",
		path: "/sessions",
		icon: "shield",
		requiredRole: UserRole.ADMIN,
	},
	{
		title: "Messages",
		path: "/messages",
		icon: "mail",
		requiredRole: UserRole.ADMIN,
	},
	{
		title: "Schemas",
		path: "/schemas",
		icon: "file-text",
		requiredRole: UserRole.VIEWER,
	},
];

const hydraNavItems: NavItem[] = [
	{
		title: "OAuth2 Clients",
		path: "/clients",
		icon: "app",
	},
];

interface SidebarProps {
	open: boolean;
	onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
	const pathname = usePathname();
	const logout = useLogout();
	const user = useUser();
	const hydraEnabled = useHydraEnabled();

	const isActive = (path: string) => {
		return pathname === path || pathname?.startsWith(`${path}/`);
	};

	const hasRequiredRole = (requiredRole?: UserRole) => {
		if (!requiredRole) return true;
		if (!user) return false;
		if (user.role === UserRole.ADMIN) return true;
		return user.role === requiredRole;
	};

	const filteredMainNavItems = mainNavItems.filter((item) =>
		hasRequiredRole(item.requiredRole),
	);
	const filteredHydraNavItems = hydraEnabled
		? hydraNavItems.filter((item) => hasRequiredRole(item.requiredRole))
		: [];

	return (
		<aside
			className={cn(
				"fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r glass-chrome transition-transform duration-300",
				open ? "translate-x-0" : "-translate-x-full",
			)}
		>
			{/* Sidebar header */}
			<div className="flex h-14 items-center justify-between px-4">
				<span className="text-lg font-semibold text-foreground">
					{APP_TITLE}
				</span>
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="h-8 w-8"
				>
					<Icon name="chevron-left" />
				</Button>
			</div>

			<Separator />

			{/* Navigation */}
			<ScrollArea className="flex-1 px-3 py-2">
				<nav className="flex flex-col gap-1">
					<TooltipProvider delayDuration={0}>
						{/* Main nav */}
						<p className="mb-1 mt-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Main
						</p>
						{filteredMainNavItems.map((item) => {
							const active = isActive(item.path);
								return (
								<Tooltip key={item.path}>
									<TooltipTrigger asChild>
										<Link
											href={item.path}
											className={cn(
												"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
												active
													? "bg-primary/10 text-primary"
													: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
											)}
										>
											<Icon name={item.icon} className="h-4 w-4" />
											<span>{item.title}</span>
										</Link>
									</TooltipTrigger>
									<TooltipContent side="right">
										{item.title}
									</TooltipContent>
								</Tooltip>
							);
						})}

						{/* Hydra nav */}
						{filteredHydraNavItems.length > 0 && (
							<>
								<Separator className="my-2" />
								<p className="mb-1 mt-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Hydra
								</p>
								{filteredHydraNavItems.map((item) => {
									const active = isActive(item.path);

									return (
										<Tooltip key={item.path}>
											<TooltipTrigger asChild>
												<Link
													href={item.path}
													className={cn(
														"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
														active
															? "bg-primary/10 text-primary"
															: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
													)}
												>
													<Icon name={item.icon} className="h-4 w-4" />
													<span>{item.title}</span>
												</Link>
											</TooltipTrigger>
											<TooltipContent side="right">
												{item.title}
											</TooltipContent>
										</Tooltip>
									);
								})}
							</>
						)}
					</TooltipProvider>
				</nav>
			</ScrollArea>

			{/* Bottom section */}
			<Separator />
			<div className="p-3">
				<button
					onClick={() => logout()}
					type="button"
					className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
				>
					<Icon name="logout" className="h-4 w-4" />
					<span>Logout</span>
				</button>
			</div>
		</aside>
	);
}

export default Sidebar;
