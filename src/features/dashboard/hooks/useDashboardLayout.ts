import { create } from "zustand";
import type { DashboardLayout, WidgetId, WidgetLayoutItem } from "../types";
import { buildDefaultLayout, WIDGET_DEFINITIONS } from "../widget-registry";

interface DashboardLayoutState {
	layout: DashboardLayout;
	isReady: boolean;
	isDirty: boolean;
	isSaving: boolean;
	initialize: () => Promise<void>;
	updateLayout: (newWidgets: WidgetLayoutItem[]) => void;
	removeWidget: (widgetId: WidgetId) => void;
	addWidget: (widgetId: WidgetId) => void;
	resizeWidget: (widgetId: WidgetId, w: number, h: number) => void;
	resetToDefault: () => void;
	/** Persist the current layout to the server. Only called on explicit user action (e.g. clicking "Done editing"). */
	saveLayout: () => Promise<void>;
}

/**
 * Persist layout to the server.
 * Refuses to save a layout with zero visible widgets — that's always a bug,
 * not an intentional user action (prevents accidental wipe during race conditions).
 */
async function persistLayout(layout: DashboardLayout) {
	if (layout.widgets.length === 0) {
		console.warn("Refusing to persist empty dashboard layout (likely a race condition)");
		return;
	}
	try {
		await fetch("/api/dashboard/layout", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ layout }),
		});
	} catch (err) {
		console.error("Failed to persist dashboard layout:", err);
	}
}

export const useDashboardLayoutStore = create<DashboardLayoutState>()((set, get) => ({
	layout: buildDefaultLayout(),
	isReady: false,
	isDirty: false,
	isSaving: false,

	initialize: async () => {
		if (get().isReady) return;

		try {
			const res = await fetch("/api/dashboard/layout");
			if (res.status === 401) {
				// Not authenticated (e.g. CIAM instance) — use defaults without persisting
				set({ layout: buildDefaultLayout(), isReady: true });
				return;
			}
			if (res.ok) {
				const data = await res.json();
				if (data.layout && Array.isArray(data.layout.widgets)) {
					// Reconcile saved layout with current widget definitions
					const validIds = new Set<WidgetId>(WIDGET_DEFINITIONS.map((d) => d.id));
					const savedWidgetIds = new Set(data.layout.widgets.map((w: WidgetLayoutItem) => w.i));
					const savedHiddenIds = new Set<WidgetId>(data.layout.hiddenWidgets || []);

					// Keep only widgets that still exist in definitions
					const widgets = (data.layout.widgets as WidgetLayoutItem[]).filter((w) => validIds.has(w.i));
					const hiddenWidgets = ((data.layout.hiddenWidgets as WidgetId[]) || []).filter((id) => validIds.has(id));

					// Any new widgets (not in saved widgets or hidden) go to hiddenWidgets
					// so the user can add them via the Add Widget dialog
					for (const def of WIDGET_DEFINITIONS) {
						if (!savedWidgetIds.has(def.id) && !savedHiddenIds.has(def.id)) {
							hiddenWidgets.push(def.id);
						}
					}

					// If saved layout has zero visible widgets, treat as corrupt and reset
					if (widgets.length === 0) {
						console.warn("Saved layout has zero visible widgets — resetting to default");
						const defaultLayout = buildDefaultLayout();
						set({ layout: defaultLayout, isReady: true });
						await persistLayout(defaultLayout);
						return;
					}

					const reconciledLayout: DashboardLayout = { widgets, hiddenWidgets };
					set({ layout: reconciledLayout, isReady: true });

					// Persist if reconciliation changed anything (new/removed widget definitions)
					const changed = widgets.length !== data.layout.widgets.length || hiddenWidgets.length !== (data.layout.hiddenWidgets || []).length;
					if (changed) {
						await persistLayout(reconciledLayout);
					}
					return;
				}

				// Server responded OK but no saved layout exists yet — use default and persist
				const defaultLayout = buildDefaultLayout();
				set({ layout: defaultLayout, isReady: true });
				await persistLayout(defaultLayout);
				return;
			}
		} catch (err) {
			console.error("Failed to load dashboard layout:", err);
		}

		// Fetch failed (network error, Kratos not ready, etc.) — use default
		// but do NOT persist so we don't overwrite the user's saved layout
		set({ layout: buildDefaultLayout(), isReady: true });
	},

	updateLayout: (newWidgets: WidgetLayoutItem[]) => {
		const current = get().layout;
		// Ensure hidden widgets don't get re-added by stale onLayoutChange callbacks
		const hiddenSet = new Set(current.hiddenWidgets);
		const updatedLayout = {
			...current,
			widgets: newWidgets.filter((w) => !hiddenSet.has(w.i)),
		};
		set({ layout: updatedLayout, isDirty: true });
	},

	removeWidget: (widgetId: WidgetId) => {
		const current = get().layout;
		const updatedLayout = {
			...current,
			widgets: current.widgets.filter((w) => w.i !== widgetId),
			hiddenWidgets: [...current.hiddenWidgets, widgetId],
		};
		set({ layout: updatedLayout, isDirty: true });
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
		set({ layout: updatedLayout, isDirty: true });
	},

	resizeWidget: (widgetId: WidgetId, w: number, h: number) => {
		const current = get().layout;
		const updatedLayout = {
			...current,
			widgets: current.widgets.map((widget) => (widget.i === widgetId ? { ...widget, w, h } : widget)),
		};
		set({ layout: updatedLayout, isDirty: true });
	},

	resetToDefault: () => {
		const defaultLayout = buildDefaultLayout();
		set({ layout: defaultLayout, isDirty: true });
	},

	saveLayout: async () => {
		const { layout, isDirty } = get();
		if (!isDirty) return;
		set({ isSaving: true });
		await persistLayout(layout);
		set({ isSaving: false, isDirty: false });
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
export const useSaveDashboardLayout = () => useDashboardLayoutStore((state) => state.saveLayout);
