"use client";

import { Button, cn, Icon, type IconName, ScrollArea, Separator, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@olympusoss/canvas";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

/* ── Nav item with animations ── */
function NavLink({
	item,
	active,
	index,
	section,
}: {
	item: NavItem;
	active: boolean;
	index: number;
	section: string;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Link href={item.path} className="relative block">
					<motion.div
						initial={{ opacity: 0, x: -12 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{
							duration: 0.3,
							delay: 0.05 + index * 0.06,
							ease: [0.22, 1, 0.36, 1],
						}}
						className={cn(
							"group/nav relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
							"transition-all duration-200 ease-out",
							active
								? "text-primary"
								: "text-muted-foreground hover:translate-x-1 hover:text-accent-foreground",
						)}
					>
						{/* Animated active background */}
						{active && (
							<motion.div
								layoutId={`nav-active-${section}`}
								className="absolute inset-0 rounded-md bg-primary/10"
								transition={{
									type: "spring",
									stiffness: 350,
									damping: 30,
								}}
							/>
						)}

						{/* CSS hover background (no flickering) */}
						{!active && (
							<div className="absolute inset-0 rounded-md bg-accent opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100" />
						)}

						{/* Active left edge indicator */}
						<AnimatePresence>
							{active && (
								<motion.div
									initial={{ scaleY: 0, opacity: 0 }}
									animate={{ scaleY: 1, opacity: 1 }}
									exit={{ scaleY: 0, opacity: 0 }}
									transition={{
										type: "spring",
										stiffness: 300,
										damping: 25,
									}}
									className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary"
								/>
							)}
						</AnimatePresence>

						{/* Icon with CSS hover animation */}
						<div className="relative z-10 h-4 w-4 shrink-0 transition-transform duration-200 group-hover/nav:scale-110">
							<Icon name={item.icon} className="h-4 w-4" />
						</div>

						<span className="relative z-10">{item.title}</span>

						{/* Active dot */}
						<AnimatePresence>
							{active && (
								<motion.div
									initial={{ scale: 0, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									exit={{ scale: 0, opacity: 0 }}
									transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 20 }}
									className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-primary"
								/>
							)}
						</AnimatePresence>
					</motion.div>
				</Link>
			</TooltipTrigger>
			<TooltipContent side="right">{item.title}</TooltipContent>
		</Tooltip>
	);
}

/* ── Section label ── */
function SectionLabel({ children, delay = 0 }: { children: string; delay?: number }) {
	return (
		<motion.p
			initial={{ opacity: 0, y: -4 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, delay }}
			className="mb-1 mt-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
		>
			{children}
		</motion.p>
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
				"fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r glass-chrome transition-transform duration-300",
				open ? "translate-x-0" : "-translate-x-full",
			)}
		>
			{/* Sidebar header */}
			<div className="flex h-14 items-center justify-between px-4">
				<motion.span
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.4, delay: 0.1 }}
					className="text-lg font-semibold text-foreground"
				>
					{APP_TITLE}
				</motion.span>
				<Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 transition-transform duration-150 hover:scale-110 active:scale-95">
					<Icon name="chevron-left" />
				</Button>
			</div>

			<Separator />

			{/* Navigation */}
			<ScrollArea className="flex-1 px-3 py-2">
				<nav className="flex flex-col gap-1">
					<TooltipProvider delayDuration={0}>
						{/* Main nav */}
						<SectionLabel delay={0}>Main</SectionLabel>
						{filteredMainNavItems.map((item, i) => (
							<NavLink
								key={item.path}
								item={item}
								active={isActive(item.path)}
								index={i}
								section="main"
							/>
						))}

						{/* Hydra nav */}
						{filteredHydraNavItems.length > 0 && (
							<>
								<Separator className="my-2" />
								<SectionLabel delay={0.3}>Hydra</SectionLabel>
								{filteredHydraNavItems.map((item, i) => (
									<NavLink
										key={item.path}
										item={item}
										active={isActive(item.path)}
										index={filteredMainNavItems.length + i}
										section="hydra"
									/>
								))}
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
					className="group/logout relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:translate-x-1 hover:text-destructive"
				>
					<div className="absolute inset-0 rounded-md bg-destructive/10 opacity-0 transition-opacity duration-150 group-hover/logout:opacity-100" />
					<div className="relative z-10 h-4 w-4 shrink-0 transition-transform duration-200 group-hover/logout:scale-110">
						<Icon name="logout" className="h-4 w-4" />
					</div>
					<span className="relative z-10">Logout</span>
				</button>
			</div>
		</aside>
	);
}

export default Sidebar;
