export {
	useAddDashboardWidget,
	useDashboardLayout,
	useDashboardLayoutReady,
	useDashboardLayoutStore,
	useInitializeDashboardLayout,
	useRemoveDashboardWidget,
	useResetDashboardLayout,
	useUpdateDashboardLayout,
} from "./hooks";
export type { DashboardLayout, WidgetDefinition, WidgetId, WidgetLayoutItem } from "./types";
export type { WidgetRenderProps } from "./widget-registry";
export { buildDefaultLayout, WIDGET_DEFINITIONS, WIDGET_RENDERERS } from "./widget-registry";
