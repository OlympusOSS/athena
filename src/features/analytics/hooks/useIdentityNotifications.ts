import type { IconName } from "@olympusoss/canvas";
import { useMemo } from "react";
import type { IdentityAnalytics, SessionAnalytics } from "../types";
import type { ServicesHealthData } from "./useAnalytics";
import type { ServiceVersionInfo } from "./useGitHubReleases";

export interface DashboardNotification {
	id: string;
	severity: "critical" | "warning" | "info";
	title: string;
	description?: string;
	timestamp?: string;
	icon?: IconName;
}

interface UseIdentityNotificationsParams {
	kratosHealthy: boolean;
	hydraHealthy: boolean;
	hydraEnabled: boolean;
	identityData: IdentityAnalytics | undefined;
	sessionData: SessionAnalytics | undefined;
	kratosRelease: ServiceVersionInfo;
	hydraRelease: ServiceVersionInfo;
	serviceHealthData?: ServicesHealthData;
}

/** Haversine distance between two lat/lng points in kilometers */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useIdentityNotifications({
	kratosHealthy,
	hydraHealthy,
	hydraEnabled,
	identityData,
	sessionData,
	kratosRelease,
	hydraRelease,
	serviceHealthData,
}: UseIdentityNotificationsParams): DashboardNotification[] {
	return useMemo(() => {
		const notifications: DashboardNotification[] = [];

		// ── Health alerts (critical) ──
		if (!kratosHealthy) {
			notifications.push({
				id: "health-kratos-down",
				severity: "critical",
				title: "Identity service is down",
				description: "Kratos is unreachable or unhealthy",
				icon: "heart-broken",
			});
		}

		if (hydraEnabled && !hydraHealthy) {
			notifications.push({
				id: "health-hydra-down",
				severity: "critical",
				title: "OAuth2 service is down",
				description: "Hydra is unreachable or unhealthy",
				icon: "heart-broken",
			});
		}

		// ── Athena & Hera service health alerts (own stack) ──
		if (serviceHealthData) {
			if (!serviceHealthData.athena.isHealthy) {
				notifications.push({
					id: "health-athena-down",
					severity: "critical",
					title: "Admin service is down",
					description: serviceHealthData.athena.error || "Athena is unreachable",
					icon: "heart-broken",
				});
			}
			if (!serviceHealthData.hera.isHealthy) {
				notifications.push({
					id: "health-hera-down",
					severity: "critical",
					title: "Auth service is down",
					description: serviceHealthData.hera.error || "Hera is unreachable",
					icon: "heart-broken",
				});
			}
		}

		// ── Version update warnings ──
		if (kratosRelease.updateAvailable && kratosRelease.latestRelease) {
			notifications.push({
				id: "version-kratos-update",
				severity: "warning",
				title: "Kratos update available",
				description: `v${kratosRelease.latestRelease.version} available (running ${kratosRelease.runningVersion || "unknown"})`,
				icon: "info",
			});
		}

		if (hydraRelease.updateAvailable && hydraRelease.latestRelease) {
			notifications.push({
				id: "version-hydra-update",
				severity: "warning",
				title: "Hydra update available",
				description: `v${hydraRelease.latestRelease.version} available (running ${hydraRelease.runningVersion || "unknown"})`,
				icon: "info",
			});
		}

		// ── Signup spike detection ──
		if (identityData?.weekOverWeekGrowth) {
			const { percentageChange } = identityData.weekOverWeekGrowth;
			if (percentageChange > 300) {
				notifications.push({
					id: "attack-signup-spike-critical",
					severity: "critical",
					title: "Unusual registration spike",
					description: `Registrations increased ${percentageChange}% vs last week`,
					icon: "trending-up",
				});
			} else if (percentageChange > 150) {
				notifications.push({
					id: "attack-signup-spike-warning",
					severity: "warning",
					title: "Registration spike detected",
					description: `Registrations increased ${percentageChange}% vs last week`,
					icon: "trending-up",
				});
			}
		}

		// ── Geographic anomaly detection ──
		if (sessionData?.sessionGeoPoints && sessionData.sessionGeoPoints.length > 1) {
			const geoPoints = sessionData.sessionGeoPoints;
			// Find primary cluster (highest count)
			const primary = geoPoints.reduce((a, b) => (b.count > a.count ? b : a), geoPoints[0]);

			// Flag single-session locations far from primary cluster
			for (const point of geoPoints) {
				if (point.count <= 1) {
					const distance = haversineKm(primary.lat, primary.lng, point.lat, point.lng);
					if (distance > 5000) {
						notifications.push({
							id: `geo-anomaly-${point.label}`,
							severity: "warning",
							title: "Login from unusual location",
							description: `Single session from ${point.label} (~${Math.round(distance)}km from primary base)`,
							icon: "globe",
						});
					}
				}
			}
		}

		// ── Sort by severity (critical first, then warning, then info) ──
		const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
		notifications.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

		return notifications;
	}, [kratosHealthy, hydraHealthy, hydraEnabled, identityData, sessionData, kratosRelease, hydraRelease, serviceHealthData]);
}
