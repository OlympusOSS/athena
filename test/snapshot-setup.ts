/**
 * Snapshot-test setup — provides jsdom polyfills that Radix UI primitives and
 * canvas components expect (matchMedia, ResizeObserver, IntersectionObserver,
 * Element pointer-capture APIs).
 *
 * This augments the base tests/setup.ts (imported for @testing-library/jest-dom
 * matchers). Do NOT edit tests/setup.ts — it is shared with the existing unit
 * test suite.
 */

import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined") {
	// jsdom's localStorage methods aren't installed in some Node versions; give
	// tests a predictable in-memory implementation so components that read/write
	// storage (e.g. ThemeProvider) don't blow up.
	const store = new Map<string, string>();
	const ls: Storage = {
		get length() {
			return store.size;
		},
		clear: () => store.clear(),
		getItem: (key) => store.get(key) ?? null,
		key: (i) => Array.from(store.keys())[i] ?? null,
		removeItem: (key) => {
			store.delete(key);
		},
		setItem: (key, value) => {
			store.set(key, String(value));
		},
	};
	Object.defineProperty(window, "localStorage", { value: ls, configurable: true });

	if (!window.matchMedia) {
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: (query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: () => {},
				removeListener: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: () => false,
			}),
		});
	}

	if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === "undefined") {
		class ResizeObserverStub {
			observe() {}
			unobserve() {}
			disconnect() {}
		}
		(globalThis as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
	}

	if (typeof (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver === "undefined") {
		class IntersectionObserverStub {
			observe() {}
			unobserve() {}
			disconnect() {}
			takeRecords() {
				return [];
			}
			root = null;
			rootMargin = "";
			thresholds: ReadonlyArray<number> = [];
		}
		(globalThis as { IntersectionObserver: unknown }).IntersectionObserver = IntersectionObserverStub;
	}

	if (typeof Element !== "undefined") {
		if (!Element.prototype.hasPointerCapture) {
			Element.prototype.hasPointerCapture = () => false;
		}
		if (!Element.prototype.setPointerCapture) {
			Element.prototype.setPointerCapture = () => {};
		}
		if (!Element.prototype.releasePointerCapture) {
			Element.prototype.releasePointerCapture = () => {};
		}
		if (!Element.prototype.scrollIntoView) {
			Element.prototype.scrollIntoView = () => {};
		}
	}
}
