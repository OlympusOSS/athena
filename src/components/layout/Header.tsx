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
	Separator,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@olympus/canvas";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLogout, useUser } from "@/features/auth/hooks/useAuth";
import { APP_TITLE } from "@/lib/constants";
import { useTheme } from "@/providers/ThemeProvider";

interface HeaderProps {
	sidebarOpen: boolean;
	onToggleSidebar: () => void;
}

export function Header({ sidebarOpen, onToggleSidebar }: HeaderProps) {
	const { theme, toggleTheme } = useTheme();
	const user = useUser();
	const logout = useLogout();
	const pathname = usePathname();

	return (
		<header className="sticky top-0 z-20 flex h-14 items-center border-b glass-chrome px-4">
			<div className="flex w-full items-center justify-between">
				{/* Left side */}
				<div className="flex items-center gap-2">
					<TooltipProvider delayDuration={0}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon" onClick={onToggleSidebar}>
									{sidebarOpen ? <Icon name="panel-left" /> : <Icon name="menu" />}
								</Button>
							</TooltipTrigger>
							<TooltipContent>{sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					{/* Show title when sidebar is collapsed */}
					{!sidebarOpen && <span className="text-sm font-semibold text-foreground">{APP_TITLE}</span>}
				</div>

				{/* Right side actions */}
				<div className="flex items-center gap-1">
					<TooltipProvider delayDuration={0}>
						{/* Settings */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon" asChild>
									<Link href="/settings">
										<Icon name="settings" />
									</Link>
								</Button>
							</TooltipTrigger>
							<TooltipContent>Settings</TooltipContent>
						</Tooltip>

						{/* Theme toggle */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon" onClick={toggleTheme}>
									{theme === "dark" ? <Icon name="sun" /> : <Icon name="moon" />}
								</Button>
							</TooltipTrigger>
							<TooltipContent>Switch to {theme === "dark" ? "light" : "dark"} mode</TooltipContent>
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
