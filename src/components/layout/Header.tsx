"use client";

import {
	Avatar,
	AvatarFallback,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Icon,
	SearchBar,
	Separator,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@olympusoss/canvas";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useLogout, useUser } from "@/features/auth/hooks/useAuth";
import { navGuard } from "@/lib/navGuard";
import { useTheme } from "@/providers/ThemeProvider";

export function Header({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) {
	const { theme, toggleTheme } = useTheme();
	const user = useUser();
	const logout = useLogout();
	const pathname = usePathname();
	const router = useRouter();
	const [searchValue, setSearchValue] = useState("");

	/* Derive page title from pathname */
	const getPageTitle = () => {
		if (!pathname) return "";
		const segment = pathname.split("/").filter(Boolean)[0] || "";
		const titles: Record<string, string> = {
			dashboard: "Dashboard",
			identities: "Identities",
			sessions: "Sessions",
			messages: "Messages",
			schemas: "Schemas",
			clients: "OAuth2 Clients",
			settings: "Settings",
			profile: "Profile",
		};
		return titles[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
	};

	return (
		<header className="glass-chrome sticky top-0 z-20 flex h-14 items-center border-b border-border px-4 sm:px-6">
			<div className="flex w-full items-center justify-between gap-4">
				{/* Left side — mobile menu + page title */}
				<div className="flex items-center gap-3">
					{onMobileMenuToggle && (
						<Button variant="ghost" size="icon" onClick={onMobileMenuToggle} className="md:hidden">
							<Icon name="menu" />
						</Button>
					)}
					<span className="text-sm font-medium text-foreground">{getPageTitle()}</span>
				</div>

				{/* Right side — search + actions */}
				<div className="flex items-center gap-2">
					{/* Search — right-aligned like Zoho */}
					<div className="hidden md:block">
						<SearchBar value={searchValue} onChange={setSearchValue} placeholder="Search identities, sessions..." className="w-64" />
					</div>

					<Separator orientation="vertical" className="mx-1 h-6" />

					<TooltipProvider delayDuration={0}>
						{/* Settings — guarded: if the MFA section has unsaved changes, show the
						    nav-guard dialog instead of navigating away silently. */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => {
										if (navGuard.isDirty()) {
											navGuard.requestGuard("/settings");
										} else {
											router.push("/settings");
										}
									}}
								>
									<Icon name="settings" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Settings</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					<Separator orientation="vertical" className="mx-2 h-6" />

					{/* User menu */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="gap-2">
								<Avatar className="h-7 w-7">
									<AvatarFallback className="text-xs">{user?.displayName?.charAt(0) || "U"}</AvatarFallback>
								</Avatar>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							{user && (
								<>
									<div className="px-3 py-2">
										<p className="text-sm font-medium">{user.displayName}</p>
										<p className="text-xs text-muted-foreground">{user.email}</p>
									</div>
									<DropdownMenuSeparator />
								</>
							)}
							<DropdownMenuItem asChild disabled={pathname === "/profile"}>
								<Link href="/profile">
									<Icon name="user" className="mr-2 h-4 w-4" />
									Profile
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={toggleTheme}>
								<Icon name={theme === "dark" ? "sun" : "moon"} className="mr-2 h-4 w-4" />
								{theme === "dark" ? "Light mode" : "Dark mode"}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive">
								<Icon name="logout" className="mr-2 h-4 w-4" />
								Logout
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</header>
	);
}
