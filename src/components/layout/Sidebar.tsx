"use client";

import { cn, Icon, type IconName, ScrollArea, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@olympusoss/canvas";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole, useLogout, useUser } from "@/features/auth";
import { useHydraEnabled } from "@/features/settings/hooks/useSettings";
import { APP_TITLE } from "@/lib/constants";

interface NavItem {
	title: string;
	path: string;
	icon: IconName;
	/** Zoho-style colored icon background (bg + text color) */
	iconColor: string;
	requiredRole?: UserRole;
}

const mainNavItems: NavItem[] = [
	{
		title: "Dashboard",
		path: "/dashboard",
		icon: "dashboard",
		iconColor: "bg-blue-500 text-white",
		requiredRole: UserRole.VIEWER,
	},
	{
		title: "Identities",
		path: "/identities",
		icon: "users",
		iconColor: "bg-purple-500 text-white",
		requiredRole: UserRole.ADMIN,
	},
	{
		title: "Sessions",
		path: "/sessions",
		icon: "shield",
		iconColor: "bg-emerald-500 text-white",
		requiredRole: UserRole.ADMIN,
	},
	{
		title: "Messages",
		path: "/messages",
		icon: "mail",
		iconColor: "bg-amber-500 text-white",
		requiredRole: UserRole.ADMIN,
	},
	{
		title: "Schemas",
		path: "/schemas",
		icon: "file-text",
		iconColor: "bg-cyan-500 text-white",
		requiredRole: UserRole.VIEWER,
	},
];

const hydraNavItems: NavItem[] = [
	{
		title: "OAuth2 Clients",
		path: "/clients",
		icon: "app",
		iconColor: "bg-rose-500 text-white",
	},
];

/* ── Nav item — Zoho CRM style with colored icon backgrounds ── */
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Link href={item.path} className="relative block">
					<div
						className={cn(
							"flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
							active ? "font-medium" : "opacity-75 hover:opacity-100",
						)}
						style={active ? { background: "hsl(var(--sidebar-active))", color: "#fff" } : { color: "hsl(var(--sidebar-fg))" }}
					>
						<div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded", item.iconColor)}>
							<Icon name={item.icon} className="h-3.5 w-3.5" />
						</div>
						<span>{item.title}</span>
					</div>
				</Link>
			</TooltipTrigger>
			<TooltipContent side="right">{item.title}</TooltipContent>
		</Tooltip>
	);
}

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

	const filteredMainNavItems = mainNavItems.filter((item) => hasRequiredRole(item.requiredRole));
	const filteredHydraNavItems = hydraEnabled ? hydraNavItems.filter((item) => hasRequiredRole(item.requiredRole)) : [];

	return (
		<aside
			className={cn(
				"glass-nav fixed inset-y-0 left-0 z-40 flex w-60 flex-col transition-transform duration-300",
				open ? "translate-x-0" : "-translate-x-full",
			)}
		>
			{/* Sidebar header — logo + title (Zoho CRM style) */}
			<div className="flex h-14 items-center justify-between px-4">
				<div className="flex items-center gap-2.5">
					{/* Olympus visor logo */}
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-400 to-blue-700">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="332 290 736 440" className="h-5 w-5" aria-label="Olympus">
							<path
								fill="#fff"
								fillRule="evenodd"
								d="M552 300H848A210 210 0 0 1 1058 510A210 210 0 0 1 848 720H552A210 210 0 0 1 342 510A210 210 0 0 1 552 300ZM582 386H818A124 124 0 0 1 942 510A124 124 0 0 1 818 634H582A124 124 0 0 1 458 510A124 124 0 0 1 582 386Z"
							/>
						</svg>
					</div>
					<span className="text-sm font-semibold" style={{ color: "#fff" }}>
						{APP_TITLE}
					</span>
				</div>
				<button
					onClick={onClose}
					type="button"
					className="flex h-7 w-7 items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity"
					style={{ color: "hsl(var(--sidebar-fg))" }}
				>
					<Icon name="chevron-left" className="h-4 w-4" />
				</button>
			</div>

			{/* Divider */}
			<div className="mx-3" style={{ borderBottom: "1px solid hsl(var(--sidebar-border))" }} />

			{/* Navigation */}
			<ScrollArea className="flex-1 px-2.5 py-2">
				<nav className="flex flex-col gap-0.5">
					<TooltipProvider delayDuration={0}>
						{/* Main nav */}
						{filteredMainNavItems.map((item) => (
							<NavLink key={item.path} item={item} active={isActive(item.path)} />
						))}

						{/* Hydra nav */}
						{filteredHydraNavItems.length > 0 && (
							<>
								<div className="mx-1 my-2" style={{ borderBottom: "1px solid hsl(var(--sidebar-border))" }} />
								{filteredHydraNavItems.map((item) => (
									<NavLink key={item.path} item={item} active={isActive(item.path)} />
								))}
							</>
						)}
					</TooltipProvider>
				</nav>
			</ScrollArea>

			{/* Bottom section */}
			<div className="mx-3" style={{ borderBottom: "1px solid hsl(var(--sidebar-border))" }} />
			<div className="p-2.5">
				<button
					onClick={() => logout()}
					type="button"
					className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm opacity-60 transition-all duration-150 hover:opacity-100"
					style={{ color: "hsl(var(--sidebar-fg))" }}
				>
					<div className="h-4 w-4 shrink-0">
						<Icon name="logout" className="h-4 w-4" />
					</div>
					<span>Logout</span>
				</button>
			</div>
		</aside>
	);
}

export default Sidebar;
