#!/usr/bin/env node
/**
 * Snapshot-coverage gate for athena.
 *
 * Scans the following component directories:
 *   - src/components/**\/*.tsx
 *   - src/features/**\/components/*.tsx
 *   - src/app/(app)/**\/components/*.tsx
 *
 * Excludes:
 *   - *.test.tsx, *.stories.tsx
 *   - page.tsx, layout.tsx
 *   - index.ts, index.tsx
 *   - src/providers/*.tsx
 *   - src/components/SettingsInitializer.tsx
 *
 * For each eligible component, verifies that a matching snapshot file exists
 * at test/__snapshots__/<basename>.test.tsx.snap.
 *
 * Exits non-zero if coverage falls below the threshold.
 *
 * Threshold can be overridden via:
 *   SNAPSHOT_COVERAGE_THRESHOLD=90   (percentage 0–100; default 80)
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = join(ROOT, "src");
const SNAPSHOT_DIR = join(ROOT, "test", "__snapshots__");

const threshold = Number(process.env.SNAPSHOT_COVERAGE_THRESHOLD ?? 80);

/* ── Exclusion predicates ───────────────────────────────────────────────── */

function isExcluded(absPath) {
	const name = basename(absPath);
	if (name.endsWith(".test.tsx") || name.endsWith(".stories.tsx")) return true;
	if (name === "page.tsx" || name === "layout.tsx") return true;
	if (name === "index.ts" || name === "index.tsx") return true;

	const rel = relative(ROOT, absPath);
	if (rel.startsWith("src/providers/")) return true;
	if (rel === "src/components/SettingsInitializer.tsx") return true;

	return false;
}

/* ── Directory walkers ──────────────────────────────────────────────────── */

/**
 * Recursively collect `.tsx` files under `dir`.
 */
function walkTsx(dir) {
	const out = [];
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry);
		let st;
		try {
			st = statSync(p);
		} catch {
			continue;
		}
		if (st.isDirectory()) {
			out.push(...walkTsx(p));
		} else if (st.isFile() && entry.endsWith(".tsx")) {
			out.push(p);
		}
	}
	return out;
}

/**
 * Collect files from `src/features/{feature}/components/*.tsx` (single-level,
 * no recursion into sub-components/).
 */
function collectFeatureComponents() {
	const out = [];
	const featuresDir = join(SRC, "features");
	if (!existsSync(featuresDir)) return out;
	for (const feature of readdirSync(featuresDir)) {
		const compDir = join(featuresDir, feature, "components");
		if (!existsSync(compDir)) continue;
		let st;
		try {
			st = statSync(compDir);
		} catch {
			continue;
		}
		if (!st.isDirectory()) continue;
		for (const entry of readdirSync(compDir)) {
			const p = join(compDir, entry);
			let es;
			try {
				es = statSync(p);
			} catch {
				continue;
			}
			if (es.isFile() && entry.endsWith(".tsx")) {
				out.push(p);
			}
		}
	}
	return out;
}

/**
 * Collect files from `src/app/(app)/**\/components/*.tsx` (single-level within
 * each components/ directory).
 */
function collectAppComponents() {
	const out = [];
	const appDir = join(SRC, "app", "(app)");
	if (!existsSync(appDir)) return out;
	function walk(dir) {
		for (const entry of readdirSync(dir)) {
			const p = join(dir, entry);
			let st;
			try {
				st = statSync(p);
			} catch {
				continue;
			}
			if (st.isDirectory()) {
				if (entry === "components") {
					for (const child of readdirSync(p)) {
						const cp = join(p, child);
						let cs;
						try {
							cs = statSync(cp);
						} catch {
							continue;
						}
						if (cs.isFile() && child.endsWith(".tsx")) {
							out.push(cp);
						}
					}
				} else {
					walk(p);
				}
			}
		}
	}
	walk(appDir);
	return out;
}

/* ── Coverage gate ──────────────────────────────────────────────────────── */

function listComponentFiles() {
	const files = new Set();

	// src/components/**/*.tsx — recursive
	for (const p of walkTsx(join(SRC, "components"))) files.add(p);

	// src/features/**/components/*.tsx
	for (const p of collectFeatureComponents()) files.add(p);

	// src/app/(app)/**/components/*.tsx
	for (const p of collectAppComponents()) files.add(p);

	const eligible = [];
	for (const p of [...files].sort()) {
		if (isExcluded(p)) continue;
		eligible.push({ path: p, rel: relative(ROOT, p) });
	}
	return eligible;
}

function hasSnapshot(componentBasename) {
	const snap = join(SNAPSHOT_DIR, `${componentBasename}.test.tsx.snap`);
	return existsSync(snap);
}

function run() {
	const components = listComponentFiles();
	const covered = [];
	const uncovered = [];

	for (const c of components) {
		const base = basename(c.path, ".tsx");
		if (hasSnapshot(base)) covered.push(c);
		else uncovered.push(c);
	}

	const total = components.length;
	const pct = total === 0 ? 100 : (covered.length / total) * 100;

	console.log(`Snapshot coverage: ${pct.toFixed(1)}% (${covered.length}/${total})`);

	if (uncovered.length) {
		console.log("\nComponents without a snapshot:");
		for (const c of uncovered) {
			console.log(`  - ${c.rel}`);
		}
	}

	if (pct < threshold) {
		console.error(`\n✖ Snapshot coverage ${pct.toFixed(1)}% is below threshold ${threshold}%.`);
		console.error(`  Add snapshot tests for the components listed above, or set`);
		console.error(`  SNAPSHOT_COVERAGE_THRESHOLD to the current floor to lock it in.`);
		process.exit(1);
	}
	console.log(`\n✓ Snapshot coverage is at or above threshold (${threshold}%).`);
}

run();
