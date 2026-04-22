"use client";

import { cn, Icon, type IconName, ScrollArea, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@olympusoss/canvas";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole, useLogout, useUser } from "@/features/auth";
import { useHydraEnabled } from "@/features/settings/hooks/useSettings";
import { APP_SUBTITLE, APP_TITLE } from "@/lib/constants";

interface NavItem {
	title: string;
	path: string;
	icon: IconName;
	/** Icon color class */
	iconColor: string;
	requiredRole?: UserRole;
}

/** A labeled group of nav items — renders a section header above its items. */
interface NavSection {
	label: string;
	items: NavItem[];
}

const mainNavItems: NavItem[] = [
	{
		title: "Dashboard",
		path: "/dashboard",
		icon: "LayoutDashboard",
		iconColor: "text-blue-500",
		requiredRole: UserRole.VIEWER,
	},
	{
		title: "Identities",
		path: "/identities",
		icon: "Users",
		iconColor: "text-purple-500",
		requiredRole: UserRole.ADMIN,
	},
	{
		title: "Sessions",
		path: "/sessions",
		icon: "Shield",
		iconColor: "text-emerald-500",
		requiredRole: UserRole.ADMIN,
	},
	{
		title: "Messages",
		path: "/messages",
		icon: "Mail",
		iconColor: "text-amber-500",
		requiredRole: UserRole.ADMIN,
	},
	{
		title: "Schemas",
		path: "/schemas",
		icon: "FileText",
		iconColor: "text-cyan-500",
		requiredRole: UserRole.VIEWER,
	},
	{
		title: "Security",
		path: "/security",
		icon: "Lock",
		iconColor: "text-red-500",
		requiredRole: UserRole.ADMIN,
	},
];

/**
 * Grouped nav sections rendered below the main nav items, above the Hydra divider.
 * Each section shows a small uppercase label followed by its nav items.
 * This matches the visual pattern of the Hydra section divider below.
 */
const navSections: NavSection[] = [
	{
		label: "Authentication",
		items: [
			{
				title: "Social Connections",
				path: "/social-connections",
				icon: "AppWindow",
				iconColor: "text-indigo-500",
				requiredRole: UserRole.ADMIN,
			},
		],
	},
];

const hydraNavItems: NavItem[] = [
	{
		title: "OAuth2 Clients",
		path: "/clients",
		icon: "AppWindow",
		iconColor: "text-rose-500",
	},
];

/**
 * Applications section — M2M OAuth2 client management (athena#50).
 * Displayed below the Hydra section when Hydra is enabled.
 *
 * iconColor follows the pre-existing sidebar pattern (see hydraNavItems).
 * Canvas NavLink primitives are used — no Tailwind utility classes beyond
 * the iconColor field which is consistent with all other nav items in this file.
 */
const applicationsNavSection: NavSection = {
	label: "Applications",
	items: [
		{
			title: "Machine-to-Machine",
			path: "/applications/m2m",
			icon: "Server",
			iconColor: "text-violet-500",
			requiredRole: UserRole.ADMIN,
		},
	],
};

/* ── Nav item with colored icons ── */
function NavLink({ item, active, collapsed, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Link href={item.path} className="relative block" onClick={onNavigate}>
					<div
						className={cn(
							"flex items-center rounded-md text-sm transition-colors duration-150",
							collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
							active ? "font-medium" : "opacity-75 hover:opacity-100",
						)}
						style={active ? { background: "hsl(var(--sidebar-active))", color: "#fff" } : { color: "hsl(var(--sidebar-fg))" }}
					>
						<Icon name={item.icon} className={cn("h-4 w-4 shrink-0", active ? "text-white" : item.iconColor)} />
						{!collapsed && <span>{item.title}</span>}
					</div>
				</Link>
			</TooltipTrigger>
			<TooltipContent side="right">{item.title}</TooltipContent>
		</Tooltip>
	);
}

interface SidebarProps {
	expanded: boolean;
	onToggle: () => void;
	onNavigate?: () => void;
}

export function Sidebar({ expanded, onToggle, onNavigate }: SidebarProps) {
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
	const filteredNavSections: NavSection[] = navSections
		.map((section) => ({
			...section,
			items: section.items.filter((item) => hasRequiredRole(item.requiredRole)),
		}))
		.filter((section) => section.items.length > 0);
	const filteredHydraNavItems = hydraEnabled ? hydraNavItems.filter((item) => hasRequiredRole(item.requiredRole)) : [];
	const filteredApplicationsItems = hydraEnabled ? applicationsNavSection.items.filter((item) => hasRequiredRole(item.requiredRole)) : [];

	return (
		<TooltipProvider delayDuration={0}>
			<aside className={cn("glass-nav fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300", expanded ? "w-60" : "w-14")}>
				{/* Sidebar header — logo + title */}
				<div className={cn("flex h-14 items-center", expanded ? "justify-between px-4" : "justify-center px-1")}>
					{expanded ? (
						<>
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
								<div className="flex flex-col leading-tight">
									<span className="text-sm font-semibold" style={{ color: "#fff" }}>
										{APP_TITLE}
									</span>
									{APP_SUBTITLE && (
										<span className="text-[10px] opacity-60" style={{ color: "#fff" }}>
											{APP_SUBTITLE}
										</span>
									)}
								</div>
							</div>
							<button
								onClick={onToggle}
								type="button"
								className="flex h-7 w-7 items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity"
								style={{ color: "hsl(var(--sidebar-fg))" }}
							>
								<Icon name="PanelLeft" className="h-4 w-4" />
							</button>
						</>
					) : (
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									onClick={onToggle}
									type="button"
									className="group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-400 to-blue-700"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="332 290 736 440"
										className="h-5 w-5 transition-opacity duration-200 group-hover:opacity-0"
										aria-label="Olympus"
									>
										<path
											fill="#fff"
											fillRule="evenodd"
											d="M552 300H848A210 210 0 0 1 1058 510A210 210 0 0 1 848 720H552A210 210 0 0 1 342 510A210 210 0 0 1 552 300ZM582 386H818A124 124 0 0 1 942 510A124 124 0 0 1 818 634H582A124 124 0 0 1 458 510A124 124 0 0 1 582 386Z"
										/>
									</svg>
									<Icon name="PanelLeft" className="absolute h-4 w-4 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
								</button>
							</TooltipTrigger>
							<TooltipContent side="right">Expand sidebar</TooltipContent>
						</Tooltip>
					)}
				</div>

				{/* Navigation */}
				<ScrollArea className={cn("flex-1 py-2", expanded ? "px-2.5" : "px-1.5")}>
					<nav className="flex flex-col gap-0.5">
						{/* Main nav */}
						{filteredMainNavItems.map((item) => (
							<NavLink key={item.path} item={item} active={isActive(item.path)} collapsed={!expanded} onNavigate={onNavigate} />
						))}

						{/* Grouped nav sections (e.g. "Authentication > Social Connections") */}
						{filteredNavSections.map((section) => (
							<div key={section.label}>
								<div className="mx-1 my-2" style={{ borderBottom: "1px solid hsl(var(--sidebar-border))" }} />
								{expanded && (
									<span
										className="block px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest"
										style={{ color: "hsl(var(--sidebar-fg))", opacity: 0.5 }}
									>
										{section.label}
									</span>
								)}
								{section.items.map((item) => (
									<NavLink key={item.path} item={item} active={isActive(item.path)} collapsed={!expanded} onNavigate={onNavigate} />
								))}
							</div>
						))}

						{/* Hydra nav */}
						{filteredHydraNavItems.length > 0 && (
							<>
								<div className="mx-1 my-2" style={{ borderBottom: "1px solid hsl(var(--sidebar-border))" }} />
								{filteredHydraNavItems.map((item) => (
									<NavLink key={item.path} item={item} active={isActive(item.path)} collapsed={!expanded} onNavigate={onNavigate} />
								))}
							</>
						)}

						{/* Applications section — M2M clients (athena#50) */}
						{filteredApplicationsItems.length > 0 && (
							<>
								<div className="mx-1 my-2" style={{ borderBottom: "1px solid hsl(var(--sidebar-border))" }} />
								{expanded && (
									<span
										className="block px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest"
										style={{ color: "hsl(var(--sidebar-fg))", opacity: 0.5 }}
									>
										{applicationsNavSection.label}
									</span>
								)}
								{filteredApplicationsItems.map((item) => (
									<NavLink key={item.path} item={item} active={isActive(item.path)} collapsed={!expanded} onNavigate={onNavigate} />
								))}
							</>
						)}
					</nav>
				</ScrollArea>

				{/* Bottom section */}
				<div className="mx-3" style={{ borderBottom: "1px solid hsl(var(--sidebar-border))" }} />
				<div className={cn("p-2.5", !expanded && "px-1.5")}>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								onClick={() => logout()}
								type="button"
								className={cn(
									"flex w-full items-center rounded-md text-sm opacity-60 transition-all duration-150 hover:opacity-100",
									expanded ? "gap-3 px-3 py-2" : "justify-center px-2 py-2",
								)}
								style={{ color: "hsl(var(--sidebar-fg))" }}
							>
								<Icon name="LogOut" className="h-4 w-4 shrink-0" />
								{expanded && <span>Logout</span>}
							</button>
						</TooltipTrigger>
						<TooltipContent side="right">Logout</TooltipContent>
					</Tooltip>
				</div>
			</aside>
		</TooltipProvider>
	);
}

export default Sidebar;
