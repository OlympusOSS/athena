import type { IconName, SecurityAlert } from "@olympusoss/canvas";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { HydraAnalytics, SessionAnalytics } from "../types";
import type { ServiceVersionInfo } from "./useGitHubReleases";

interface GitHubAdvisory {
	ghsa_id: string;
	cve_id: string | null;
	summary: string;
	description: string;
	severity: string;
	html_url: string;
	published_at: string;
	vulnerabilities: Array<{
		package: { name: string; ecosystem: string };
		vulnerable_version_range: string;
		first_patched_version: string | null;
	}>;
}

interface UseSecurityInsightsParams {
	sessionData: SessionAnalytics | undefined;
	hydraData: HydraAnalytics | undefined;
	kratosRelease: ServiceVersionInfo;
	hydraRelease: ServiceVersionInfo;
	hydraEnabled: boolean;
}

/** Fetch GitHub security advisories for a repository */
async function fetchSecurityAdvisories(repo: string): Promise<GitHubAdvisory[]> {
	try {
		const response = await fetch(`https://api.github.com/repos/${repo}/security-advisories?state=published&per_page=10`, {
			headers: { Accept: "application/vnd.github.v3+json" },
		});

		if (!response.ok) {
			// Security advisories API may require auth or return 404
			// Fall back silently
			return [];
		}

		return response.json();
	} catch {
		return [];
	}
}

/** Compare two version strings: -1 if a < b, 0 if equal, 1 if a > b */
/** Strip SemVer pre-release and build metadata, leaving only MAJOR.MINOR.PATCH */
function baseVer(v: string): string {
	return v.replace(/^v/, "").split(/[-+]/)[0];
}

function compareVersions(a: string, b: string): number {
	const parse = (v: string) => baseVer(v).split(".").map(Number);
	const pa = parse(a);
	const pb = parse(b);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const na = pa[i] ?? 0;
		const nb = pb[i] ?? 0;
		if (Number.isNaN(na) || Number.isNaN(nb)) return 0;
		if (na < nb) return -1;
		if (na > nb) return 1;
	}
	return 0;
}

/**
 * Returns true if `version` falls within a GitHub advisory vulnerable_version_range.
 * Handles ranges like ">= 1.0, < 2.0", bare versions like "v25.4.0", and
 * SemVer pre-release/build strings like "v1.3.2+oryOS.17" or "1.0.0-rc.14".
 * Falls back to true (show the advisory) if the range is empty/unparseable.
 */
function isVersionAffected(version: string, range: string): boolean {
	const conditions = range.split(",").map((s) => s.trim());
	for (const cond of conditions) {
		// Match optional operator then version (which may include pre-release/build suffixes)
		const match = cond.match(/^([<>]=?)\s*v?([\d][\w.+-]*)$/);
		if (!match) {
			// Bare version string — exact MAJOR.MINOR.PATCH match
			const exact = cond.match(/^v?([\d][\w.+-]*)$/);
			if (exact && compareVersions(version, exact[1]) !== 0) return false;
			continue;
		}
		const [, op, bound] = match;
		const cmp = compareVersions(version, bound);
		if (op === "<" && cmp >= 0) return false;
		if (op === "<=" && cmp > 0) return false;
		if (op === ">" && cmp <= 0) return false;
		if (op === ">=" && cmp < 0) return false;
	}
	return true;
}

/** Map GitHub severity to our severity */
function mapGitHubSeverity(severity: string): "critical" | "warning" | "info" {
	switch (severity.toLowerCase()) {
		case "critical":
		case "high":
			return "critical";
		case "medium":
			return "warning";
		default:
			return "info";
	}
}

/** Format relative time for display */
function formatRelativeTimestamp(isoDate: string): string {
	const diff = Date.now() - new Date(isoDate).getTime();
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	if (days === 0) return "Today";
	if (days === 1) return "1d ago";
	if (days < 30) return `${days}d ago`;
	if (days < 365) return `${Math.floor(days / 30)}mo ago`;
	return `${Math.floor(days / 365)}y ago`;
}

export function useSecurityInsights({ sessionData, hydraData, kratosRelease, hydraRelease, hydraEnabled }: UseSecurityInsightsParams): {
	alerts: SecurityAlert[];
	isLoading: boolean;
} {
	// Fetch GitHub security advisories
	const kratosAdvisories = useQuery({
		queryKey: ["github-advisories", "ory/kratos"],
		queryFn: () => fetchSecurityAdvisories("ory/kratos"),
		staleTime: 60 * 60 * 1000, // 1 hour
		refetchInterval: 2 * 60 * 60 * 1000, // 2 hours
		refetchOnWindowFocus: false,
		retry: 1,
	});

	const hydraAdvisories = useQuery({
		queryKey: ["github-advisories", "ory/hydra"],
		queryFn: () => fetchSecurityAdvisories("ory/hydra"),
		enabled: hydraEnabled,
		staleTime: 60 * 60 * 1000,
		refetchInterval: 2 * 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
	});

	const athenaAdvisories = useQuery({
		queryKey: ["github-advisories", "OlympusOSS/athena"],
		queryFn: () => fetchSecurityAdvisories("OlympusOSS/athena"),
		staleTime: 60 * 60 * 1000,
		refetchInterval: 2 * 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
	});

	const heraAdvisories = useQuery({
		queryKey: ["github-advisories", "OlympusOSS/hera"],
		queryFn: () => fetchSecurityAdvisories("OlympusOSS/hera"),
		staleTime: 60 * 60 * 1000,
		refetchInterval: 2 * 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
	});

	const alerts = useMemo(() => {
		const result: SecurityAlert[] = [];

		// ── CVE / Security advisories ──
		const addAdvisories = (advisories: GitHubAdvisory[], serviceName: string, runningVersion: string | null) => {
			for (const advisory of advisories) {
				// Only show advisories that affect the running version.
				// If runningVersion is unknown, fall back to showing all (conservative).
				if (runningVersion && advisory.vulnerabilities.length > 0) {
					const affected = advisory.vulnerabilities.some((v) => isVersionAffected(runningVersion, v.vulnerable_version_range));
					if (!affected) continue;
				}
				result.push({
					id: `cve-${advisory.ghsa_id}`,
					severity: mapGitHubSeverity(advisory.severity),
					category: "cve",
					title: advisory.cve_id ? `${advisory.cve_id} (${serviceName})` : `${advisory.ghsa_id} (${serviceName})`,
					description: advisory.summary,
					timestamp: formatRelativeTimestamp(advisory.published_at),
					icon: "shield-alert" as IconName,
					link: advisory.html_url,
				});
			}
		};

		if (kratosAdvisories.data) {
			addAdvisories(kratosAdvisories.data, "Kratos", kratosRelease.runningVersion);
		}
		if (hydraAdvisories.data) {
			addAdvisories(hydraAdvisories.data, "Hydra", hydraRelease.runningVersion);
		}
		if (athenaAdvisories.data) {
			addAdvisories(athenaAdvisories.data, "Athena", null);
		}
		if (heraAdvisories.data) {
			addAdvisories(heraAdvisories.data, "Hera", null);
		}

		// ── DDoS indicators — session creation rate spikes ──
		if (sessionData?.sessionsByHour) {
			const hourCounts = sessionData.sessionsByHour.map((h) => h.count);
			const totalSessions = hourCounts.reduce((a, b) => a + b, 0);
			const avgPerHour = totalSessions / 24;

			if (avgPerHour > 0) {
				const maxHourCount = Math.max(...hourCounts);
				const maxHourIndex = hourCounts.indexOf(maxHourCount);

				if (maxHourCount > avgPerHour * 10) {
					result.push({
						id: "ddos-session-spike-critical",
						severity: "critical",
						category: "ddos",
						title: "Possible DDoS — extreme session spike",
						description: `${maxHourCount} sessions at ${maxHourIndex}:00 (avg: ${Math.round(avgPerHour)}/hr)`,
						icon: "globe" as IconName,
					});
				} else if (maxHourCount > avgPerHour * 5) {
					result.push({
						id: "ddos-session-spike-warning",
						severity: "warning",
						category: "ddos",
						title: "Unusual session creation rate",
						description: `${maxHourCount} sessions at ${maxHourIndex}:00 (avg: ${Math.round(avgPerHour)}/hr)`,
						icon: "globe" as IconName,
					});
				}
			}
		}

		// ── Rate anomaly — daily session spike ──
		if (sessionData?.sessionsByDay && sessionData.sessionsByDay.length > 7) {
			const dayCounts = sessionData.sessionsByDay.map((d) => d.count);
			const last7 = dayCounts.slice(-7);
			const prior = dayCounts.slice(0, -7);

			if (prior.length > 0) {
				const priorAvg = prior.reduce((a, b) => a + b, 0) / prior.length;
				const todayCount = last7[last7.length - 1] || 0;

				if (priorAvg > 0 && todayCount > priorAvg * 5) {
					result.push({
						id: "rate-daily-spike",
						severity: "warning",
						category: "rate",
						title: "Daily session rate anomaly",
						description: `${todayCount} sessions today vs ${Math.round(priorAvg)} avg/day`,
						icon: "trending-up" as IconName,
					});
				}
			}
		}

		// ── OAuth2 anomalies ──
		if (hydraData?.clientsByGrantType && hydraData.clientsByGrantType.length > 0) {
			const totalGrantConfigs = hydraData.clientsByGrantType.reduce((a, b) => a + b.count, 0);
			const clientCredentials = hydraData.clientsByGrantType.find((g) => g.grantType === "client_credentials");

			// If client_credentials is >80% of all grant configurations, flag it
			if (clientCredentials && totalGrantConfigs > 0) {
				const ratio = clientCredentials.count / totalGrantConfigs;
				if (ratio > 0.8 && totalGrantConfigs > 3) {
					result.push({
						id: "oauth2-client-credentials-heavy",
						severity: "info",
						category: "oauth2",
						title: "Client credentials dominance",
						description: `${Math.round(ratio * 100)}% of OAuth2 clients use client_credentials grant`,
						icon: "key-round" as IconName,
					});
				}
			}
		}

		// ── Sort by severity ──
		const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
		result.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

		return result;
	}, [kratosAdvisories.data, hydraAdvisories.data, athenaAdvisories.data, heraAdvisories.data, sessionData, hydraData, kratosRelease.runningVersion, hydraRelease.runningVersion]);

	return {
		alerts,
		isLoading: kratosAdvisories.isLoading || (hydraEnabled && hydraAdvisories.isLoading) || athenaAdvisories.isLoading || heraAdvisories.isLoading,
	};
}
