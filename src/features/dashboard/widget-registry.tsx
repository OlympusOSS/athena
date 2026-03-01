import {
	ActivityFeed,
	AnimatedBarChart,
	AnimatedPieChart,
	ChartCard,
	ChartCardWithFilter,
	Icon,
	MultiSeriesAreaChart,
	StatCard,
	VerificationGauge,
	WorldHeatMap,
	YearlyBarChart,
} from "@olympusoss/canvas";
import type { ReactNode } from "react";
import type { WidgetDefinition, WidgetId } from "./types";

/**
 * All available dashboard widgets with their metadata.
 * Used for the default layout, add-widget dialog, and Hydra filtering.
 */
export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
	// ── Stat Cards ──────────────────────────────────────
	{
		id: "stat-total-users",
		title: "Total Users",
		description: "Total number of registered users",
		icon: "users",
		category: "stat",
		defaultW: 2,
		defaultH: 2,
	},
	{
		id: "stat-active-sessions",
		title: "Active Users",
		description: "Unique users with active sessions",
		icon: "shield",
		category: "stat",
		defaultW: 2,
		defaultH: 2,
	},
	{
		id: "stat-avg-session",
		title: "Avg Session Duration",
		description: "Average session duration",
		icon: "time",
		category: "stat",
		defaultW: 2,
		defaultH: 2,
	},
	{
		id: "stat-user-growth",
		title: "User Growth",
		description: "New users this week with trend",
		icon: "trending-up",
		category: "stat",
		defaultW: 2,
		defaultH: 2,
	},
	{
		id: "stat-kratos-health",
		title: "Kratos Health",
		description: "Kratos system health status",
		icon: "health",
		category: "stat",
		defaultW: 2,
		defaultH: 2,
	},
	{
		id: "stat-hydra-health",
		title: "Hydra Health",
		description: "Hydra system health status",
		icon: "cloud",
		category: "stat",
		defaultW: 2,
		defaultH: 2,
		requiresHydra: true,
	},

	// ── Charts ──────────────────────────────────────────
	{
		id: "chart-combined-activity",
		title: "Activity Overview",
		description: "Sign-ups and logins over time",
		icon: "activity",
		category: "chart",
		defaultW: 12,
		defaultH: 6,
		minW: 4,
		minH: 3,
	},
	{
		id: "chart-users-by-schema",
		title: "Users by Schema",
		description: "Identity distribution by schema",
		icon: "shapes",
		category: "chart",
		defaultW: 3,
		defaultH: 4,
		minW: 2,
		minH: 3,
	},
	{
		id: "chart-verification-gauge",
		title: "Email Verification Rate",
		description: "Visual gauge of email verification rate",
		icon: "verified",
		category: "chart",
		defaultW: 3,
		defaultH: 4,
		minW: 2,
		minH: 3,
	},
	{
		id: "chart-peak-hours",
		title: "Peak Activity Hours",
		description: "Login activity distribution by hour",
		icon: "bar-chart",
		category: "chart",
		defaultW: 6,
		defaultH: 6,
		minW: 3,
		minH: 3,
	},
	{
		id: "chart-session-locations",
		title: "Session Locations",
		description: "World heat map of session origins",
		icon: "globe",
		category: "chart",
		defaultW: 6,
		defaultH: 6,
		minW: 4,
		minH: 4,
	},
	{
		id: "chart-activity-feed",
		title: "Recent Activity",
		description: "Latest signups and logins",
		icon: "activity",
		category: "chart",
		defaultW: 3,
		defaultH: 4,
		minW: 2,
		minH: 3,
	},
	{
		id: "chart-oauth2-grant-types",
		title: "OAuth2 Grant Types Usage",
		description: "Distribution of OAuth2 grant types",
		icon: "key-round",
		category: "chart",
		defaultW: 3,
		defaultH: 4,
		minW: 2,
		minH: 3,
		requiresHydra: true,
	},
];

/** Time range options for Activity Overview */
const ACTIVITY_TIME_RANGE_OPTIONS = [
	{ value: "7d", label: "Last 7 Days" },
	{ value: "14d", label: "Last 14 Days" },
	{ value: "30d", label: "Last 30 Days" },
];

/** Time range options for Peak Hours */
const PEAK_HOURS_TIME_RANGE_OPTIONS = [
	{ value: "today", label: "Today" },
	{ value: "7d", label: "Last 7 Days" },
	{ value: "14d", label: "Last 14 Days" },
	{ value: "30d", label: "Last 30 Days" },
	{ value: "60d", label: "Last 60 Days" },
	{ value: "90d", label: "Last 90 Days" },
	{ value: "180d", label: "Last 180 Days" },
	{ value: "1y", label: "Last Year" },
	{ value: "all", label: "All Time" },
];

/**
 * Props passed to each widget renderer function.
 */
export interface WidgetRenderProps {
	identity: {
		data: any;
	};
	session: {
		data: any;
	};
	system: {
		data: any;
	};
	hydra: {
		data: any;
	};
	formatNumber: (n: number) => string;
	formatDuration: (ms: number) => string;
	formatRelativeTime: (ts: string) => string;
	// Derived data
	verificationRate: number;
	schemasPieData: Array<{ name: string; value: number }>;
	peakHoursBarData: Array<{ label: string; value: number }>;
	growthTrend?: { value: number; label?: string; direction?: "up" | "down" };
	activityFeedItems: Array<{
		id: string;
		timestamp: string;
		label: string;
		type: string;
		detail: string;
		icon: ReactNode;
	}>;
	grantTypesPieData: Array<{ name: string; value: number }>;
	// Sparkline data for stat cards
	userSparkline: number[];
	sessionSparkline: number[];
	// Growth bar data — [previous week, current week]
	growthBarData: number[];
	// Registrations by week (last 4 weeks, oldest first)
	registrationsByWeek: number[];
	totalGrowth4Weeks: number;
	// Combined activity chart
	combinedActivitySeries: Array<{
		id: string;
		label: string;
		data: Array<{ label: string; value: number }>;
		color?: string;
	}>;
	// Yearly data for stat card bar charts
	identitiesByYear: Array<{ year: number; count: number }>;
	activeUsersByYear: Array<{ year: number; count: number }>;
	// Session locations (geo-resolved)
	geoPoints: Array<{ lat: number; lng: number; label: string; count: number }>;
	// Time range filter state
	activityTimeRange: string;
	onActivityTimeRangeChange: (value: string) => void;
	// Peak hours time range filter
	peakHoursTimeRange: string;
	onPeakHoursTimeRangeChange: (value: string) => void;
}

/**
 * Widget renderers — maps each WidgetId to the React element that renders it.
 */
export const WIDGET_RENDERERS: Record<WidgetId, (props: WidgetRenderProps) => ReactNode> = {
	"stat-total-users": ({ identity, formatNumber, identitiesByYear }) => (
		<StatCard
			colorVariant="primary"
			title="Total Users"
			value={formatNumber(identity.data?.totalIdentities || 0)}
			icon={<Icon name="users" />}
			sparkline={identitiesByYear.length > 0 ? <YearlyBarChart data={identitiesByYear} height={28} color="primary" /> : undefined}
		/>
	),

	"stat-active-sessions": ({ session, formatNumber, activeUsersByYear }) => (
		<StatCard
			colorVariant="blue"
			title="Active Users"
			value={formatNumber(session.data?.totalActiveUsers || 0)}
			icon={<Icon name="shield" />}
			sparkline={activeUsersByYear.length > 0 ? <YearlyBarChart data={activeUsersByYear} height={28} color="chart-1" /> : undefined}
		/>
	),

	"stat-avg-session": ({ session, formatDuration }) => (
		<StatCard
			colorVariant="purple"
			title="Avg Session"
			value={formatDuration(session.data?.averageSessionDuration || 0)}
			subtitle={`${session.data?.activeSessions || 0} active now`}
			icon={<Icon name="time" />}
		/>
	),

	"stat-user-growth": ({ totalGrowth4Weeks, growthTrend, registrationsByWeek }) => {
		const labels = ["Week 1", "Week 2", "Week 3", "Week 4"];
		const reversed = [...registrationsByWeek].reverse();
		const barData = reversed.map((count, i) => ({ year: i, count, label: labels[i] }));
		return (
			<StatCard
				colorVariant="success"
				title="User Growth"
				value={totalGrowth4Weeks}
				icon={<Icon name="trending-up" />}
				trend={growthTrend ? { value: growthTrend.value, direction: growthTrend.direction } : undefined}
				sparkline={barData.length > 0 ? <YearlyBarChart data={barData} height={28} color="success" minBarWidth={32} /> : undefined}
			/>
		);
	},

	"stat-kratos-health": ({ system }) => (
		<StatCard
			colorVariant="success"
			title="Kratos Health"
			value={system.data?.systemHealth === "healthy" ? "\u2713 Healthy" : system.data?.systemHealth || "Unknown"}
			subtitle={system.data?.systemHealth || "Unknown"}
			icon={<Icon name="health" />}
		/>
	),

	"stat-hydra-health": ({ hydra }) => (
		<StatCard
			colorVariant="success"
			title="Hydra Health"
			value={hydra.data?.systemHealth === "healthy" ? "\u2713 Healthy" : hydra.data?.systemHealth === "error" ? "\u2717 Error" : "Unknown"}
			subtitle={hydra.data?.systemHealth || "Unknown"}
			icon={<Icon name="cloud" />}
		/>
	),

	"chart-combined-activity": ({ combinedActivitySeries, activityTimeRange, onActivityTimeRangeChange }) => (
		<ChartCardWithFilter
			title="Activity Overview"
			timeRangeOptions={ACTIVITY_TIME_RANGE_OPTIONS}
			selectedTimeRange={activityTimeRange}
			onTimeRangeChange={onActivityTimeRangeChange}
		>
			<MultiSeriesAreaChart series={combinedActivitySeries} height="100%" showLegend />
		</ChartCardWithFilter>
	),

	"chart-users-by-schema": ({ schemasPieData }) => (
		<ChartCard title="Users by Schema">
			<AnimatedPieChart data={schemasPieData} height="100%" innerRadius={25} outerRadius={55} />
		</ChartCard>
	),

	"chart-verification-gauge": ({ verificationRate, identity }) => (
		<ChartCard title="Verification Rate">
			<VerificationGauge
				value={verificationRate}
				label={`${identity.data?.verificationStatus?.verified || 0} of ${(identity.data?.verificationStatus?.verified || 0) + (identity.data?.verificationStatus?.unverified || 0)} verified`}
			/>
		</ChartCard>
	),

	"chart-peak-hours": ({ peakHoursBarData, peakHoursTimeRange, onPeakHoursTimeRangeChange }) => (
		<ChartCardWithFilter
			title="Peak Activity Hours"
			timeRangeOptions={PEAK_HOURS_TIME_RANGE_OPTIONS}
			selectedTimeRange={peakHoursTimeRange}
			onTimeRangeChange={onPeakHoursTimeRangeChange}
		>
			<AnimatedBarChart data={peakHoursBarData} height="100%" color="chart-3" />
		</ChartCardWithFilter>
	),

	"chart-session-locations": ({ geoPoints }) => <WorldHeatMap data={geoPoints} color="chart-1" title="Session Locations" />,

	"chart-activity-feed": ({ activityFeedItems, formatRelativeTime }) => (
		<ChartCard title="Recent Activity">
			<ActivityFeed items={activityFeedItems} formatTimestamp={(ts) => formatRelativeTime(ts)} />
		</ChartCard>
	),

	"chart-oauth2-grant-types": ({ grantTypesPieData }) => (
		<ChartCard title="OAuth2 Grant Types">
			<AnimatedPieChart data={grantTypesPieData} height="100%" innerRadius={25} outerRadius={55} />
		</ChartCard>
	),
};

/**
 * Builds the default dashboard layout by auto-placing widgets into a 12-column grid.
 */
export function buildDefaultLayout(): {
	widgets: Array<{ i: WidgetId; x: number; y: number; w: number; h: number; minW?: number; minH?: number; maxW?: number; maxH?: number }>;
	hiddenWidgets: WidgetId[];
	version: number;
} {
	const widgets: Array<{ i: WidgetId; x: number; y: number; w: number; h: number; minW?: number; minH?: number; maxW?: number; maxH?: number }> = [];
	const _currentX = 0;
	const _currentY = 0;
	const cols = 12;

	// Track the maximum Y at each X position to handle variable-height items
	const colHeights = new Array(cols).fill(0);

	for (const def of WIDGET_DEFINITIONS) {
		// Find the position where this widget fits
		let bestX = 0;
		let bestY = Number.MAX_SAFE_INTEGER;

		// Find the column with the lowest height where this widget fits
		for (let x = 0; x <= cols - def.defaultW; x++) {
			let maxHeight = 0;
			for (let dx = 0; dx < def.defaultW; dx++) {
				maxHeight = Math.max(maxHeight, colHeights[x + dx]);
			}
			if (maxHeight < bestY) {
				bestY = maxHeight;
				bestX = x;
			}
		}

		widgets.push({
			i: def.id,
			x: bestX,
			y: bestY,
			w: def.defaultW,
			h: def.defaultH,
			minW: def.minW,
			minH: def.minH,
			maxW: def.maxW,
			maxH: def.maxH,
		});

		// Update column heights
		for (let dx = 0; dx < def.defaultW; dx++) {
			colHeights[bestX + dx] = bestY + def.defaultH;
		}
	}

	return {
		widgets,
		hiddenWidgets: [],
		version: 17,
	};
}
