/**
 * navGuard — module-level navigation guard signal.
 *
 * Allows any component (e.g. Header) to check whether there is unsaved state
 * that should block navigation, and to request that the guard dialog be shown,
 * without needing React context or prop drilling.
 *
 * Usage:
 *   // In the component that owns dirty state (settings page):
 *   import { navGuard } from "@/lib/navGuard";
 *   navGuard.setDirty(true, (url) => { blockedUrlRef.current = url; setShowGuard(true); });
 *
 *   // In any component that navigates (Header):
 *   import { navGuard } from "@/lib/navGuard";
 *   if (navGuard.isDirty()) {
 *     navGuard.requestGuard("/settings"); // triggers the registered dialog
 *   } else {
 *     router.push("/settings");
 *   }
 */

type GuardCallback = (intendedUrl: string) => void;

let _dirty = false;
let _onGuardRequested: GuardCallback | null = null;

export const navGuard = {
	/**
	 * Update the dirty flag and register (or clear) the guard callback.
	 * @param dirty - whether unsaved changes exist
	 * @param onGuardRequested - called when a component requests the guard dialog;
	 *   receives the intended navigation URL so the dialog can navigate there on confirm.
	 *   Pass null to clear the callback when the guard owner unmounts.
	 */
	setDirty(dirty: boolean, onGuardRequested: GuardCallback | null): void {
		_dirty = dirty;
		_onGuardRequested = dirty ? onGuardRequested : null;
	},

	/** Returns true when there are unsaved changes that should block navigation. */
	isDirty(): boolean {
		return _dirty;
	},

	/**
	 * Requests the guard dialog from whatever component registered it.
	 * @param intendedUrl - the URL the user was trying to navigate to.
	 * No-op if no callback is registered.
	 */
	requestGuard(intendedUrl: string): void {
		_onGuardRequested?.(intendedUrl);
	},

	/** Reset all state — call on unmount of the guard owner. */
	reset(): void {
		_dirty = false;
		_onGuardRequested = null;
	},
};
