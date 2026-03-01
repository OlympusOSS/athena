"use client";

import type { Layout, Layouts } from "@olympusoss/canvas";
import {
	AddWidgetDialog,
	Alert,
	AlertDescription,
	Button,
	DashboardGrid,
	ErrorState,
	Icon,
	LoadingState,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
	WidgetShell,
} from "@olympusoss/canvas";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, ProtectedPage } from "@/components/layout";
import { useAnalytics } from "@/features/analytics/hooks";
import { UserRole } from "@/features/auth";
import type { WidgetId, WidgetRenderProps } from "@/features/dashboard";
import { useDashboardLayoutStore, WIDGET_DEFINITIONS, WIDGET_RENDERERS } from "@/features/dashboard";
import { useFormatters } from "@/hooks";
import { parseError } from "@/utils/errors";

export default function Dashboard() {
	const { identity, session, system, hydra, isLoading, isError, isHydraAvailable, hydraEnabled, refetchAll } = useAnalytics();
	const { formatNumber, formatDuration, formatRelativeTime } = useFormatters();
	const router = useRouter();
	const [addWidgetOpen, setAddWidgetOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [activityTimeRange, setActivityTimeRange] = useState("30d");
	const [peakHoursTimeRange, setPeakHoursTimeRange] = useState("1y");

	// Dashboard layout state
	const layout = useDashboardLayoutStore((s) => s.layout);
	const isReady = useDashboardLayoutStore((s) => s.isReady);
	const initialize = useDashboardLayoutStore((s) => s.initialize);
	const updateLayout = useDashboardLayoutStore((s) => s.updateLayout);
	const removeWidget = useDashboardLayoutStore((s) => s.removeWidget);
	const addWidget = useDashboardLayoutStore((s) => s.addWidget);
	const resetToDefault = useDashboardLayoutStore((s) => s.resetToDefault);

	// Initialize layout on mount
	useEffect(() => {
		initialize();
	}, [initialize]);

	// ── Memoized chart data ──────────────────────────────

	const identityChartData = useMemo(
		() =>
			(identity.data?.identitiesByDay || []).map((item: { date: string; count: number }) => ({
				label: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
				value: item.count,
			})),
		[identity.data?.identitiesByDay],
	);

	const sessionChartData = useMemo(
		() =>
			(session.data?.sessionsByDay || []).map((item: { date: string; count: number }) => ({
				label: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
				value: item.count,
			})),
		[session.data?.sessionsByDay],
	);

	// Sparkline data — just the raw numbers for compact visualizations
	const userSparkline = useMemo(
		() => (identity.data?.identitiesByDay || []).map((item: { count: number }) => item.count),
		[identity.data?.identitiesByDay],
	);
	const sessionSparkline = useMemo(
		() => (session.data?.sessionsByDay || []).map((item: { count: number }) => item.count),
		[session.data?.sessionsByDay],
	);

	const verificationRate = useMemo(() => {
		if (!identity.data) return 0;
		const { verified, unverified } = identity.data.verificationStatus;
		return Math.round((verified / (verified + unverified)) * 100);
	}, [identity.data]);

	const peakHoursBarData = useMemo(() => {
		const timestamps: string[] = session.data?.sessionTimestamps || [];
		if (timestamps.length === 0) return [];

		const now = Date.now();
		const rangeDays: Record<string, number | null> = {
			today: 1,
			"7d": 7,
			"14d": 14,
			"30d": 30,
			"60d": 60,
			"90d": 90,
			"180d": 180,
			"1y": 365,
			all: null,
		};
		const days = rangeDays[peakHoursTimeRange] ?? null;
		const cutoff = days ? now - days * 24 * 60 * 60 * 1000 : 0;

		const hourCounts = new Array(24).fill(0);
		for (const ts of timestamps) {
			const t = new Date(ts).getTime();
			if (t >= cutoff) {
				hourCounts[new Date(ts).getHours()]++;
			}
		}
		return hourCounts.map((count, hour) => ({
			label: `${hour.toString().padStart(2, "0")}`,
			value: count,
		}));
	}, [session.data?.sessionTimestamps, peakHoursTimeRange]);

	const growthTrend = useMemo(() => {
		if (!identity.data?.weekOverWeekGrowth) return undefined;
		const { percentageChange, direction } = identity.data.weekOverWeekGrowth;
		if (direction === "flat") return undefined;
		return {
			value: Math.abs(percentageChange),
			direction: direction as "up" | "down",
		};
	}, [identity.data?.weekOverWeekGrowth]);

	// Weekly registration data for User Growth widget
	const registrationsByWeek = useMemo(() => identity.data?.registrationsByWeek || [0, 0, 0, 0], [identity.data?.registrationsByWeek]);
	const totalGrowth4Weeks = useMemo(() => identity.data?.totalGrowth4Weeks || 0, [identity.data?.totalGrowth4Weeks]);

	const activityFeedItems = useMemo(() => {
		const signups = (identity.data?.recentSignups || []).map((s: { id: string; timestamp: string; email: string; schemaId: string }) => ({
			id: `signup-${s.id}`,
			timestamp: s.timestamp,
			label: s.email,
			type: "Signup",
			detail: `Schema: ${s.schemaId}`,
			icon: <Icon name="add" size={14} />,
		}));

		const logins = (session.data?.recentLogins || []).map((l: { id: string; timestamp: string; email: string; method: string }) => ({
			id: `login-${l.id}`,
			timestamp: l.timestamp,
			label: l.email,
			type: "Login",
			detail: `Method: ${l.method}`,
			icon: <Icon name="key" size={14} />,
		}));

		return [...signups, ...logins].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20);
	}, [identity.data?.recentSignups, session.data?.recentLogins]);

	const schemasPieData = useMemo(
		() =>
			(identity.data?.identitiesBySchema || []).map((item: { schema: string; count: number }) => ({
				name: item.schema.length > 20 ? `${item.schema.slice(0, 20)}...` : item.schema,
				value: item.count,
			})),
		[identity.data?.identitiesBySchema],
	);

	const grantTypesPieData = useMemo(
		() =>
			(hydra.data?.clientsByGrantType || []).map((item: { grantType: string; count: number }) => ({
				name: item.grantType.length > 20 ? `${item.grantType.slice(0, 20)}...` : item.grantType,
				value: item.count,
			})),
		[hydra.data?.clientsByGrantType],
	);

	// Yearly data for stat card bar charts
	const identitiesByYear = useMemo(() => identity.data?.identitiesByYear || [], [identity.data?.identitiesByYear]);
	const activeUsersByYear = useMemo(() => session.data?.activeUsersByYear || [], [session.data?.activeUsersByYear]);

	// Growth bar data — [previous week, current week] for mini bar chart
	const growthBarData = useMemo(() => {
		const wowg = identity.data?.weekOverWeekGrowth;
		if (!wowg) return [];
		return [wowg.previousWeekCount, wowg.currentWeekCount];
	}, [identity.data?.weekOverWeekGrowth]);

	// ── Combined activity, traffic, location data ────────

	const combinedActivitySeries = useMemo(() => {
		const days = ({ "7d": 7, "14d": 14, "30d": 30 } as Record<string, number>)[activityTimeRange] ?? 30;
		return [
			{ id: "signups", label: "Sign-ups", data: identityChartData.slice(-days), color: "chart-1" },
			{ id: "logins", label: "Logins", data: sessionChartData.slice(-days), color: "chart-2" },
		];
	}, [identityChartData, sessionChartData, activityTimeRange]);

	const geoPoints = useMemo(() => session.data?.sessionGeoPoints || [], [session.data?.sessionGeoPoints]);

	// ── Widget render props ──────────────────────────────

	const renderProps: WidgetRenderProps = useMemo(
		() => ({
			identity,
			session,
			system,
			hydra,
			formatNumber,
			formatDuration,
			formatRelativeTime,
			verificationRate,
			schemasPieData,
			peakHoursBarData,
			growthTrend,
			activityFeedItems,
			grantTypesPieData,
			userSparkline,
			sessionSparkline,
			growthBarData,
			registrationsByWeek,
			totalGrowth4Weeks,
			identitiesByYear,
			activeUsersByYear,
			combinedActivitySeries,
			geoPoints,
			activityTimeRange,
			onActivityTimeRangeChange: setActivityTimeRange,
			peakHoursTimeRange,
			onPeakHoursTimeRangeChange: setPeakHoursTimeRange,
		}),
		[
			identity,
			session,
			system,
			hydra,
			formatNumber,
			formatDuration,
			formatRelativeTime,
			verificationRate,
			schemasPieData,
			peakHoursBarData,
			growthTrend,
			activityFeedItems,
			grantTypesPieData,
			userSparkline,
			sessionSparkline,
			growthBarData,
			registrationsByWeek,
			totalGrowth4Weeks,
			identitiesByYear,
			activeUsersByYear,
			combinedActivitySeries,
			geoPoints,
			activityTimeRange,
			peakHoursTimeRange,
		],
	);

	// ── Layout handlers ──────────────────────────────────

	const handleLayoutChange = useCallback(
		(_currentLayout: Layout, allLayouts: Layouts) => {
			// Use the xl breakpoint layout as the source of truth
			const xlLayout = allLayouts.xl || _currentLayout;
			// Read latest state directly from the store to avoid stale closures
			const currentWidgets = useDashboardLayoutStore.getState().layout.widgets;
			const widgetMap = new Map(currentWidgets.map((w) => [w.i, w]));

			const updatedWidgets = xlLayout
				.filter((item) => widgetMap.has(item.i as WidgetId))
				.map((item) => {
					const existing = widgetMap.get(item.i as WidgetId)!;
					return {
						...existing,
						x: item.x,
						y: item.y,
						w: item.w,
						h: item.h,
					};
				});

			updateLayout(updatedWidgets);
		},
		[updateLayout],
	);

	const handleRemoveWidget = useCallback(
		(widgetId: string) => {
			removeWidget(widgetId as WidgetId);
		},
		[removeWidget],
	);

	const handleAddWidget = useCallback(
		(widgetId: string) => {
			addWidget(widgetId as WidgetId);
		},
		[addWidget],
	);

	// ── Filter widgets ──────────────────────────────────

	const visibleWidgets = useMemo(() => {
		const hydraWidgetIds = new Set(WIDGET_DEFINITIONS.filter((d) => d.requiresHydra).map((d) => d.id));

		return layout.widgets.filter((w) => {
			if (!isHydraAvailable && hydraWidgetIds.has(w.i)) return false;
			return true;
		});
	}, [layout.widgets, isHydraAvailable]);

	// Build react-grid-layout Layouts object
	const gridLayouts = useMemo<Layouts>(() => {
		const xlLayout = visibleWidgets.map((w) => ({
			i: w.i,
			x: w.x,
			y: w.y,
			w: w.w,
			h: w.h,
			minW: w.minW,
			minH: w.minH,
			maxW: w.maxW,
			maxH: w.maxH,
		}));

		return { xl: xlLayout, lg: xlLayout, md: xlLayout, sm: xlLayout, xs: xlLayout };
	}, [visibleWidgets]);

	// Available widgets for the add dialog
	const availableWidgets = useMemo(() => {
		const hydraWidgetIds = new Set(WIDGET_DEFINITIONS.filter((d) => d.requiresHydra).map((d) => d.id));

		return layout.hiddenWidgets
			.filter((id) => {
				if (!isHydraAvailable && hydraWidgetIds.has(id)) return false;
				return true;
			})
			.map((id) => {
				const def = WIDGET_DEFINITIONS.find((d) => d.id === id);
				if (!def) return null;
				return {
					id: def.id,
					title: def.title,
					description: def.description,
					icon: <Icon name={def.icon as any} size={16} />,
					category: def.category,
				};
			})
			.filter(Boolean) as Array<{ id: string; title: string; description: string; icon: ReactNode; category: string }>;
	}, [layout.hiddenWidgets, isHydraAvailable]);

	// ── Loading / Error states ──────────────────────────

	if (isLoading || !isReady) {
		return <LoadingState variant="page" message="Loading analytics data..." />;
	}

	if (isError) {
		const firstError = identity.error || session.error || system.error || hydra.error;
		const parsedError = parseError(firstError);

		return (
			<ProtectedPage requiredRole={UserRole.VIEWER}>
				<ErrorState
					variant="page"
					title={parsedError.title}
					message={parsedError.message}
					action={parsedError.canRetry ? { label: "Retry", onClick: refetchAll, icon: <Icon name="refresh" /> } : undefined}
					secondaryAction={
						parsedError.suggestSettings
							? { label: "Check Settings", onClick: () => router.push("/settings"), icon: <Icon name="settings" /> }
							: undefined
					}
				/>
			</ProtectedPage>
		);
	}

	return (
		<ProtectedPage requiredRole={UserRole.VIEWER}>
			<PageHeader
				title="Analytics and Status"
				actions={
					<>
						{/* Refresh — always visible */}
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="outline" size="icon" onClick={refetchAll} aria-label="Refresh data">
										<Icon name="refresh" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Refresh Data</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						{/* Add Widget — edit mode only */}
						{isEditMode && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button variant="outline" size="icon" onClick={() => setAddWidgetOpen(true)} aria-label="Add widget">
											<Icon name="add" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Add Widget</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}

						{/* Reset Layout — edit mode only */}
						{isEditMode && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button variant="outline" size="icon" onClick={resetToDefault} aria-label="Reset layout">
											<Icon name="reset" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Reset Layout</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}

						{/* Edit toggle */}
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant={isEditMode ? "default" : "outline"}
										size="icon"
										onClick={() => setIsEditMode((prev) => !prev)}
										aria-label={isEditMode ? "Done editing" : "Edit layout"}
									>
										<Icon name={isEditMode ? "check" : "edit"} />
									</Button>
								</TooltipTrigger>
								<TooltipContent>{isEditMode ? "Done Editing" : "Edit Layout"}</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</>
				}
			/>

			{/* Hydra not available info banner */}
			{!isHydraAvailable && (
				<Alert>
					<Icon name="info" />
					<AlertDescription>
						{!hydraEnabled
							? "Hydra integration is disabled. Enable it in Settings to view OAuth2 analytics."
							: "Hydra is not available. OAuth2 analytics are hidden. Check your Hydra configuration in Settings."}
					</AlertDescription>
				</Alert>
			)}

			{/* Dashboard Grid */}
			<DashboardGrid
				layouts={gridLayouts}
				onLayoutChange={handleLayoutChange}
				isEditable={isEditMode}
				className={isEditMode ? "dashboard-grid-editing" : undefined}
			>
				{visibleWidgets.map((widget) => {
					const renderer = WIDGET_RENDERERS[widget.i];
					if (!renderer) return null;

					return (
						<div key={widget.i}>
							<WidgetShell id={widget.i} onRemove={() => handleRemoveWidget(widget.i)} isEditable={isEditMode}>
								{renderer(renderProps)}
							</WidgetShell>
						</div>
					);
				})}
			</DashboardGrid>

			{/* Add Widget Dialog */}
			<AddWidgetDialog open={addWidgetOpen} onOpenChange={setAddWidgetOpen} availableWidgets={availableWidgets} onAddWidget={handleAddWidget} />
		</ProtectedPage>
	);
}
