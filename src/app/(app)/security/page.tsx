"use client";

import {
	Alert,
	AlertDescription,
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Icon,
	Toast,
	Toaster,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
	useToast,
} from "@olympusoss/canvas";
import { AdminLayout, PageHeader } from "@/components/layout";
import { UserRole } from "@/features/auth";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { LockedAccountsTable } from "@/features/security/components/LockedAccountsTable";
import { useLockedAccounts } from "@/features/security/hooks/useLockedAccounts";

export default function SecurityPage() {
	const { toast, show: showToast, dismiss } = useToast();
	const { data, isLoading, isError, error, refetch, isFetching } = useLockedAccounts();

	const accounts = data?.data ?? [];
	const total = data?.total ?? 0;

	const handleUnlockSuccess = (identifier: string) => {
		showToast(`Account "${identifier}" has been unlocked.`, "success");
	};

	const handleUnlockError = (_identifier: string, err: Error) => {
		showToast(err.message || "Failed to unlock account.", "destructive");
	};

	return (
		<ProtectedRoute requiredRole={UserRole.ADMIN}>
			<AdminLayout>
				<div className="space-y-6">
					<PageHeader
						title="Locked Accounts"
						subtitle="View and manually unlock accounts locked due to too many failed login attempts"
						icon={<Icon name="lock" />}
						actions={
							<TooltipProvider delayDuration={0}>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching}>
											<Icon name={isFetching ? "loading" : "refresh"} className={isFetching ? "animate-spin" : undefined} />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Refresh</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						}
					/>

					{data?.truncated && (
						<Alert variant="default">
							<Icon name="danger" />
							<AlertDescription>Showing 500 of {total} locked accounts. Some accounts may not be displayed.</AlertDescription>
						</Alert>
					)}

					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="text-base">Active Lockouts</CardTitle>
								{!isLoading && (
									<Badge variant={total > 0 ? "destructive" : "secondary"}>
										{total} {total === 1 ? "account" : "accounts"} locked
									</Badge>
								)}
							</div>
						</CardHeader>
						<CardContent className="pt-0">
							{isError ? (
								<div className="flex flex-col items-center gap-4 py-10 text-center">
									<Icon name="danger" className="h-8 w-8 text-destructive" />
									<p className="text-sm text-muted-foreground">{error?.message ?? "Failed to load locked accounts. Please try again."}</p>
									<Button variant="outline" onClick={() => refetch()}>
										<Icon name="refresh" className="h-4 w-4" />
										Retry
									</Button>
								</div>
							) : (
								<LockedAccountsTable
									accounts={accounts}
									isLoading={isLoading}
									onUnlockSuccess={handleUnlockSuccess}
									onUnlockError={handleUnlockError}
								/>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardContent>
							<h2 className="text-sm font-semibold text-foreground">About Account Lockouts</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								Accounts are automatically locked when too many failed login attempts occur within a sliding time window. Thresholds are configurable
								in Settings under the Security category. Lockouts expire automatically — use the Unlock action to immediately restore access without
								waiting for the lockout to expire.
							</p>
						</CardContent>
					</Card>
				</div>

				<Toaster>
					<Toast {...toast} onClose={dismiss} />
				</Toaster>
			</AdminLayout>
		</ProtectedRoute>
	);
}
