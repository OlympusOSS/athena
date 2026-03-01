import { useQuery } from "@tanstack/react-query";
import { useHydraEnabled, useIsOryNetwork, useSettingsLoaded } from "@/features/settings/hooks/useSettings";
import { clusterGeoResults, resolveIPs } from "@/services/geo";
import { checkHydraHealth, listOAuth2Clients } from "@/services/hydra";
import { checkKratosHealth, getAllIdentities, getSessionsUntilDate, listIdentitySchemas, listSessions } from "@/services/kratos";
import type { HydraAnalytics, IdentityAnalytics, SessionAnalytics, SystemAnalytics } from "../types";
import { calculatePercentageChange } from "../utils";

// Health check hooks
const useKratosHealthCheck = (isOryNetwork: boolean, isSettingsLoaded: boolean) => {
	return useQuery({
		queryKey: ["health", "kratos", isOryNetwork],
		queryFn: async () => {
			// Ory Network does not provide health check endpoints
			if (isOryNetwork) {
				return { isHealthy: true };
			}
			return checkKratosHealth();
		},
		enabled: isSettingsLoaded, // Wait for settings to load before checking health
		staleTime: 2 * 60 * 1000, // Cache for 2 minutes
		retry: 1, // Only retry once for health checks
	});
};

const useHydraHealthCheck = (isOryNetwork: boolean, isSettingsLoaded: boolean, hydraEnabled: boolean) => {
	return useQuery({
		queryKey: ["health", "hydra", isOryNetwork, hydraEnabled],
		queryFn: async () => {
			// If Hydra is disabled, return as not healthy (but not an error)
			if (!hydraEnabled) {
				return { isHealthy: false, disabled: true };
			}
			// Ory Network does not provide health check endpoints
			if (isOryNetwork) {
				return { isHealthy: true };
			}
			return checkHydraHealth();
		},
		enabled: isSettingsLoaded, // Wait for settings to load before checking health
		staleTime: 2 * 60 * 1000, // Cache for 2 minutes
		retry: 1, // Only retry once for health checks
	});
};

// Hook to fetch comprehensive identity analytics
export const useIdentityAnalytics = (isKratosHealthy: boolean) => {
	return useQuery({
		queryKey: ["analytics", "identities"],
		queryFn: async (): Promise<IdentityAnalytics> => {
			// Use the centralized getAllIdentities function
			const result = await getAllIdentities({
				maxPages: 20,
				pageSize: 250,
				onProgress: (count, page) => console.log(`Analytics: Fetched ${count} identities (page ${page})`),
			});

			const allIdentities = result.identities;

			// Process the data
			const now = new Date();
			const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

			// Count new identities in last 30 days
			const newIdentitiesLast30Days = allIdentities.filter((identity) => {
				const createdAt = new Date(identity.created_at);
				return createdAt >= thirtyDaysAgo;
			}).length;

			// Group identities by day (last 30 days)
			const identitiesByDay: Array<{ date: string; count: number }> = [];
			for (let i = 29; i >= 0; i--) {
				const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
				const dateStr = date.toISOString().split("T")[0];
				const count = allIdentities.filter((identity) => {
					const createdAt = new Date(identity.created_at);
					return createdAt.toISOString().split("T")[0] === dateStr;
				}).length;
				identitiesByDay.push({ date: dateStr, count });
			}

			// Group identities by year (for yearly bar chart)
			const yearGroups = allIdentities.reduce(
				(acc, identity) => {
					const year = new Date(identity.created_at).getFullYear();
					acc[year] = (acc[year] || 0) + 1;
					return acc;
				},
				{} as Record<number, number>,
			);

			const identitiesByYear = Object.entries(yearGroups)
				.map(([year, count]) => ({ year: Number(year), count: count as number }))
				.sort((a, b) => b.year - a.year); // Latest year first

			// Group by schema
			const schemaGroups = allIdentities.reduce(
				(acc, identity) => {
					const schema = identity.schema_id || "unknown";
					acc[schema] = (acc[schema] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>,
			);

			const identitiesBySchema = Object.entries(schemaGroups).map(([schema, count]) => ({
				schema,
				count: count as number,
			}));

			// Verification status (check if email is verified)
			let verified = 0;
			let unverified = 0;

			allIdentities.forEach((identity) => {
				const verifiableAddresses = identity.verifiable_addresses || [];
				const hasVerifiedEmail = verifiableAddresses.some((addr: any) => addr.verified);
				if (hasVerifiedEmail) {
					verified++;
				} else {
					unverified++;
				}
			});

			// Weekly registration counts (last 4 weeks, oldest first)
			const registrationsByWeek: number[] = [];
			for (let w = 3; w >= 0; w--) {
				const weekStart = new Date(now.getTime() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
				const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
				const count = allIdentities.filter((identity) => {
					const createdAt = new Date(identity.created_at);
					return createdAt >= weekStart && createdAt < weekEnd;
				}).length;
				registrationsByWeek.push(count);
			}
			const totalGrowth4Weeks = registrationsByWeek.reduce((a, b) => a + b, 0);

			// Week-over-week growth (this week vs last week)
			const currentWeekCount = registrationsByWeek[3]; // This week
			const previousWeekCount = registrationsByWeek[2]; // Last week

			const percentageChange = calculatePercentageChange(currentWeekCount, previousWeekCount);
			const direction = percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "flat";

			// Recent signups (top 20)
			const recentSignups = [...allIdentities]
				.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
				.slice(0, 20)
				.map((identity) => ({
					id: identity.id,
					timestamp: identity.created_at,
					email: identity.traits?.email || identity.traits?.username || identity.id,
					schemaId: identity.schema_id || "unknown",
				}));

			return {
				totalIdentities: allIdentities.length,
				newIdentitiesLast30Days,
				identitiesByDay,
				identitiesByYear,
				identitiesBySchema,
				verificationStatus: { verified, unverified },
				weekOverWeekGrowth: {
					currentWeekCount,
					previousWeekCount,
					percentageChange: Math.round(percentageChange * 10) / 10,
					direction: direction as "up" | "down" | "flat",
				},
				registrationsByWeek,
				totalGrowth4Weeks,
				recentSignups,
			};
		},
		enabled: isKratosHealthy, // Only fetch when Kratos is healthy
		staleTime: 5 * 60 * 1000, // Cache for 5 minutes
		refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
	});
};

// Hook to fetch session analytics
export const useSessionAnalytics = (isKratosHealthy: boolean) => {
	return useQuery({
		queryKey: ["analytics", "sessions"],
		queryFn: async (): Promise<SessionAnalytics> => {
			// Fetch sessions up to 1 year ago for analytics (peak hours, locations, etc.)
			const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
			const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			const result = await getSessionsUntilDate({
				maxPages: 10,
				pageSize: 250,
				active: undefined, // Get all sessions (active and inactive)
				untilDate: oneYearAgo,
				expand: ["identity", "devices"],
				onProgress: (count, page) => console.log(`Analytics: Fetched ${count} sessions (page ${page})`),
			});

			const sessions = result.sessions;

			const now = new Date();

			// Count sessions in last 7 days
			const sessionsLast7Days = sessions.filter((session) => {
				if (!session.authenticated_at) return false;
				const authenticatedAt = new Date(session.authenticated_at);
				if (Number.isNaN(authenticatedAt.getTime())) return false;
				return authenticatedAt >= sevenDaysAgo;
			}).length;

			// Group sessions by day (last 30 days) - count sessions that were active on each day
			const sessionsByDay: Array<{ date: string; count: number }> = [];
			for (let i = 29; i >= 0; i--) {
				const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
				const dateStr = date.toISOString().split("T")[0];
				const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
				const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

				const count = sessions.filter((session) => {
					if (!session.authenticated_at) return false;

					const authenticatedAt = new Date(session.authenticated_at);
					if (Number.isNaN(authenticatedAt.getTime())) return false;

					// Session must have started before or on this day
					if (authenticatedAt > dayEnd) return false;

					// If session has expiry, it must not have expired before this day started
					if (session.expires_at) {
						const expiresAt = new Date(session.expires_at);
						if (Number.isNaN(expiresAt.getTime())) return true; // If invalid expiry, assume still active
						if (expiresAt < dayStart) return false; // Expired before this day
					}

					// Session was active during this day
					return true;
				}).length;

				sessionsByDay.push({ date: dateStr, count });
			}

			// Calculate average session duration (time from authentication to now or expiry)
			const currentTime = Date.now();
			const sessionDurations = sessions
				.filter((session) => session.authenticated_at)
				.map((session) => {
					const authenticated = new Date(session.authenticated_at || "").getTime();
					const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : currentTime;
					const endTime = expiresAt < currentTime ? expiresAt : currentTime;
					return Math.max(0, endTime - authenticated) / (1000 * 60); // minutes
				});

			const averageSessionDuration =
				sessionDurations.length > 0 ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length : 0;

			// Get active sessions count using API filter
			const activeSessionsResponse = await listSessions(true);
			const activeSessions = activeSessionsResponse.data.length;

			// Active users by year (unique identity IDs with sessions per year)
			const activeUserYearSets: Record<number, Set<string>> = {};
			sessions.forEach((session) => {
				if (!session.authenticated_at || !session.identity?.id) return;
				const year = new Date(session.authenticated_at).getFullYear();
				if (!activeUserYearSets[year]) activeUserYearSets[year] = new Set();
				activeUserYearSets[year].add(session.identity.id);
			});

			const activeUsersByYear = Object.entries(activeUserYearSets)
				.map(([year, ids]) => ({ year: Number(year), count: ids.size }))
				.sort((a, b) => b.year - a.year); // Latest year first

			// Total unique active users (across all years)
			const allActiveUserIds = new Set<string>();
			for (const ids of Object.values(activeUserYearSets)) {
				for (const id of ids) allActiveUserIds.add(id);
			}
			const totalActiveUsers = allActiveUserIds.size;

			// Authentication method breakdown
			const methodCounts: Record<string, number> = {};
			sessions.forEach((session) => {
				const methods = (session as any).authentication_methods || [];
				const uniqueMethods = new Set(methods.map((m: any) => m.method).filter(Boolean));
				uniqueMethods.forEach((method) => {
					methodCounts[method as string] = (methodCounts[method as string] || 0) + 1;
				});
			});
			const authMethodBreakdown = Object.entries(methodCounts)
				.map(([method, count]) => ({ method, count: count as number }))
				.sort((a, b) => b.count - a.count);

			// Sessions by hour of day (0-23)
			const hourCounts = new Array(24).fill(0);
			sessions.forEach((session) => {
				if (session.authenticated_at) {
					const hour = new Date(session.authenticated_at).getHours();
					hourCounts[hour]++;
				}
			});
			const sessionsByHour = hourCounts.map((count, hour) => ({ hour, count }));

			// Recent logins (top 20)
			const recentLogins = sessions
				.filter((s) => s.authenticated_at && s.identity)
				.sort((a, b) => new Date(b.authenticated_at!).getTime() - new Date(a.authenticated_at!).getTime())
				.slice(0, 20)
				.map((session) => ({
					id: session.id,
					timestamp: session.authenticated_at!,
					email: session.identity?.traits?.email || session.identity?.traits?.username || session.identity?.id || "Unknown",
					method: ((session as any).authentication_methods || [])[0]?.method || "unknown",
					identityId: session.identity?.id || "",
				}));

			// Location breakdown — resolve device IPs to lat/lng coordinates
			const allIPs: string[] = [];
			sessions.forEach((session) => {
				const devices = (session as any).devices || [];
				devices.forEach((device: any) => {
					if (device.ip_address) {
						allIPs.push(device.ip_address);
					}
				});
			});

			let sessionGeoPoints: Array<{ lat: number; lng: number; label: string; count: number }> = [];
			if (allIPs.length > 0) {
				try {
					const geoResults = await resolveIPs(allIPs);
					sessionGeoPoints = clusterGeoResults(geoResults);
				} catch (err) {
					console.warn("[analytics] IP geolocation failed:", err);
				}
			}

			// Collect session timestamps for client-side peak hours filtering
			const sessionTimestamps = sessions.filter((s) => s.authenticated_at).map((s) => s.authenticated_at!);

			return {
				totalSessions: sessions.length,
				activeSessions,
				totalActiveUsers,
				activeUsersByYear,
				sessionsByDay,
				averageSessionDuration: Math.round(averageSessionDuration),
				sessionsLast7Days,
				authMethodBreakdown,
				sessionsByHour,
				sessionTimestamps,
				recentLogins,
				sessionGeoPoints,
			};
		},
		enabled: isKratosHealthy, // Only fetch when Kratos is healthy
		staleTime: 2 * 60 * 1000, // Cache for 2 minutes
		refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
	});
};

// Hook to fetch system analytics
export const useSystemAnalytics = (isKratosHealthy: boolean) => {
	return useQuery({
		queryKey: ["analytics", "system"],
		queryFn: async (): Promise<SystemAnalytics> => {
			const schemasResponse = await listIdentitySchemas();
			const schemas = schemasResponse.data;

			return {
				totalSchemas: schemas.length,
				systemHealth: "healthy", // Could be enhanced with actual health checks
				lastUpdated: new Date(),
			};
		},
		enabled: isKratosHealthy, // Only fetch when Kratos is healthy
		staleTime: 10 * 60 * 1000, // Cache for 10 minutes
		refetchInterval: 15 * 60 * 1000, // Refetch every 15 minutes
	});
};

// Hook to fetch Hydra analytics
export const useHydraAnalytics = (isHydraHealthy: boolean) => {
	return useQuery({
		queryKey: ["analytics", "hydra"],
		queryFn: async (): Promise<HydraAnalytics> => {
			try {
				// Fetch OAuth2 clients
				const clientsResponse = await listOAuth2Clients({ page_size: 500 });
				const clients = Array.isArray(clientsResponse.data) ? clientsResponse.data : [];

				// Count public vs confidential clients
				const publicClients = clients.filter((client) => client.token_endpoint_auth_method === "none").length;
				const confidentialClients = clients.length - publicClients;

				// Group by grant types
				const grantTypeGroups: Record<string, number> = {};
				clients.forEach((client) => {
					client.grant_types?.forEach((grantType) => {
						grantTypeGroups[grantType] = (grantTypeGroups[grantType] || 0) + 1;
					});
				});

				const clientsByGrantType = Object.entries(grantTypeGroups).map(([grantType, count]) => ({
					grantType,
					count: count as number,
				}));

				// Note: Consent sessions require a specific subject parameter
				// so we can't get a global count easily. Set to 0 for now.
				const consentSessions = 0;

				return {
					totalClients: clients.length,
					publicClients,
					confidentialClients,
					clientsByGrantType,
					consentSessions,
					tokensIssued: 0, // This would require additional API calls to get token statistics
					systemHealth: "healthy",
				};
			} catch (error) {
				console.error("Failed to fetch Hydra analytics:", error);
				// Return empty/zero data on error
				return {
					totalClients: 0,
					publicClients: 0,
					confidentialClients: 0,
					clientsByGrantType: [],
					consentSessions: 0,
					tokensIssued: 0,
					systemHealth: "error",
				};
			}
		},
		enabled: isHydraHealthy, // Only fetch when Hydra is healthy
		staleTime: 5 * 60 * 1000, // Cache for 5 minutes
		refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
	});
};

// Combined analytics hook
export const useAnalytics = () => {
	// Get Ory Network flag, settings loaded state, and Hydra enabled flag
	const isOryNetwork = useIsOryNetwork();
	const isSettingsLoaded = useSettingsLoaded();
	const hydraEnabled = useHydraEnabled();

	// Check health first (waits for settings to load)
	const kratosHealth = useKratosHealthCheck(isOryNetwork, isSettingsLoaded);
	const hydraHealth = useHydraHealthCheck(isOryNetwork, isSettingsLoaded, hydraEnabled);

	const isKratosHealthy = kratosHealth.data?.isHealthy ?? false;
	const isHydraHealthy = hydraHealth.data?.isHealthy ?? false;
	// Hydra is "available" if it's enabled AND healthy
	const isHydraAvailable = hydraEnabled && isHydraHealthy;

	// Only fetch analytics if services are healthy
	const identityAnalytics = useIdentityAnalytics(isKratosHealthy);
	const sessionAnalytics = useSessionAnalytics(isKratosHealthy);
	const systemAnalytics = useSystemAnalytics(isKratosHealthy);
	const hydraAnalytics = useHydraAnalytics(isHydraHealthy);

	// Determine loading state - include waiting for settings
	// Only include Hydra loading state if Hydra is enabled
	const isLoading =
		!isSettingsLoaded ||
		kratosHealth.isLoading ||
		(hydraEnabled && hydraHealth.isLoading) ||
		(isKratosHealthy && (identityAnalytics.isLoading || sessionAnalytics.isLoading || systemAnalytics.isLoading)) ||
		(isHydraHealthy && hydraAnalytics.isLoading);

	// Determine error state - Hydra unhealthy is NOT a fatal error
	// Only Kratos health issues are treated as fatal errors
	const isError =
		kratosHealth.isError ||
		(!kratosHealth.data?.isHealthy && !kratosHealth.isLoading) ||
		identityAnalytics.isError ||
		sessionAnalytics.isError ||
		systemAnalytics.isError;

	// Get the first error (prioritize Kratos health check errors)
	let firstError: any = null;
	if (!kratosHealth.data?.isHealthy && !kratosHealth.isLoading && kratosHealth.data?.error) {
		firstError = new Error(kratosHealth.data.error);
	} else {
		firstError = identityAnalytics.error || sessionAnalytics.error || systemAnalytics.error;
	}

	return {
		identity: {
			...identityAnalytics,
			error: firstError || identityAnalytics.error,
		},
		session: {
			...sessionAnalytics,
			error: firstError || sessionAnalytics.error,
		},
		system: { ...systemAnalytics, error: firstError || systemAnalytics.error },
		hydra: { ...hydraAnalytics, error: hydraAnalytics.error },
		isLoading,
		isError,
		isHydraAvailable,
		hydraEnabled,
		refetchAll: () => {
			kratosHealth.refetch();
			if (hydraEnabled) {
				hydraHealth.refetch();
			}
			identityAnalytics.refetch();
			sessionAnalytics.refetch();
			systemAnalytics.refetch();
			if (isHydraHealthy) {
				hydraAnalytics.refetch();
			}
		},
	};
};
