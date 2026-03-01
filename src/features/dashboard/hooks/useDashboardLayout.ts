import { create } from "zustand";
import type { DashboardLayout, WidgetId, WidgetLayoutItem } from "../types";
import { buildDefaultLayout, WIDGET_DEFINITIONS } from "../widget-registry";

const LAYOUT_VERSION = 17;

interface DashboardLayoutState {
	layout: DashboardLayout;
	isReady: boolean;
	isSaving: boolean;
	initialize: () => Promise<void>;
	updateLayout: (newWidgets: WidgetLayoutItem[]) => void;
	removeWidget: (widgetId: WidgetId) => void;
	addWidget: (widgetId: WidgetId) => void;
	resizeWidget: (widgetId: WidgetId, w: number, h: number) => void;
	resetToDefault: () => void;
}

// Debounce timer for API saves
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Persist layout to the server (debounced).
 */
function persistLayout(layout: DashboardLayout) {
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(async () => {
		try {
			await fetch("/api/dashboard/layout", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ layout }),
			});
		} catch (err) {
			console.error("Failed to persist dashboard layout:", err);
		}
	}, 300);
}

export const useDashboardLayoutStore = create<DashboardLayoutState>()((set, get) => ({
	layout: buildDefaultLayout(),
	isReady: false,
	isSaving: false,

	initialize: async () => {
		if (get().isReady) return;

		try {
			const res = await fetch("/api/dashboard/layout");
			if (res.ok) {
				const data = await res.json();
				if (data.layout && data.layout.version === LAYOUT_VERSION && Array.isArray(data.layout.widgets)) {
					set({ layout: data.layout, isReady: true });
					return;
				}
			}
		} catch (err) {
			console.error("Failed to load dashboard layout:", err);
		}

		// No saved layout or version mismatch — use default
		const defaultLayout = buildDefaultLayout();
		set({ layout: defaultLayout, isReady: true });
		persistLayout(defaultLayout);
	},

	updateLayout: (newWidgets: WidgetLayoutItem[]) => {
		const current = get().layout;
		// Ensure hidden widgets don't get re-added by stale onLayoutChange callbacks
		const hiddenSet = new Set(current.hiddenWidgets);
		const updatedLayout = {
			...current,
			widgets: newWidgets.filter((w) => !hiddenSet.has(w.i)),
		};
		set({ layout: updatedLayout });
		persistLayout(updatedLayout);
	},

	removeWidget: (widgetId: WidgetId) => {
		const current = get().layout;
		const updatedLayout = {
			...current,
			widgets: current.widgets.filter((w) => w.i !== widgetId),
			hiddenWidgets: [...current.hiddenWidgets, widgetId],
		};
		set({ layout: updatedLayout });
		persistLayout(updatedLayout);
	},

	addWidget: (widgetId: WidgetId) => {
		const current = get().layout;
		const def = WIDGET_DEFINITIONS.find((d) => d.id === widgetId);
		if (!def) return;

		// Find the max Y to place the widget at the bottom
		const maxY = current.widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);

		const newWidget: WidgetLayoutItem = {
			i: widgetId,
			x: 0,
			y: maxY,
			w: def.defaultW,
			h: def.defaultH,
			minW: def.minW,
			minH: def.minH,
			maxW: def.maxW,
			maxH: def.maxH,
		};

		const updatedLayout = {
			...current,
			widgets: [...current.widgets, newWidget],
			hiddenWidgets: current.hiddenWidgets.filter((id) => id !== widgetId),
		};
		set({ layout: updatedLayout });
		persistLayout(updatedLayout);
	},

	resizeWidget: (widgetId: WidgetId, w: number, h: number) => {
		const current = get().layout;
		const updatedLayout = {
			...current,
			widgets: current.widgets.map((widget) => (widget.i === widgetId ? { ...widget, w, h } : widget)),
		};
		set({ layout: updatedLayout });
		persistLayout(updatedLayout);
	},

	resetToDefault: () => {
		const defaultLayout = buildDefaultLayout();
		set({ layout: defaultLayout });
		persistLayout(defaultLayout);
	},
}));

// Convenience hooks
export const useDashboardLayout = () => useDashboardLayoutStore((state) => state.layout);
export const useDashboardLayoutReady = () => useDashboardLayoutStore((state) => state.isReady);
export const useInitializeDashboardLayout = () => useDashboardLayoutStore((state) => state.initialize);
export const useUpdateDashboardLayout = () => useDashboardLayoutStore((state) => state.updateLayout);
export const useRemoveDashboardWidget = () => useDashboardLayoutStore((state) => state.removeWidget);
export const useAddDashboardWidget = () => useDashboardLayoutStore((state) => state.addWidget);
export const useResetDashboardLayout = () => useDashboardLayoutStore((state) => state.resetToDefault);
