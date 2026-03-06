/**
 * Unique identifier for each dashboard widget.
 */
export type WidgetId =
	| "stat-total-users"
	| "stat-active-sessions"
	| "stat-avg-session"
	| "stat-user-growth"
	| "chart-combined-activity"
	| "chart-users-by-schema"
	| "chart-verification-gauge"
	| "chart-peak-hours"
	| "chart-activity-feed"
	| "chart-oauth2-grant-types"
	| "chart-session-locations"
	| "chart-security-insights";

/**
 * Layout item for a widget — based on react-grid-layout's Layout type.
 */
export interface WidgetLayoutItem {
	i: WidgetId;
	x: number;
	y: number;
	w: number;
	h: number;
	minW?: number;
	minH?: number;
	maxW?: number;
	maxH?: number;
}

/**
 * Persisted dashboard layout (stored in Kratos identity metadata_public).
 */
export interface DashboardLayout {
	widgets: WidgetLayoutItem[];
	hiddenWidgets: WidgetId[];
}

/**
 * Widget definition metadata — used for the registry and add-widget dialog.
 */
export interface WidgetDefinition {
	id: WidgetId;
	title: string;
	description: string;
	icon: string;
	category: "stat" | "chart";
	defaultW: number;
	defaultH: number;
	minW?: number;
	minH?: number;
	maxW?: number;
	maxH?: number;
	/** Whether this widget requires Hydra to be available */
	requiresHydra?: boolean;
}
