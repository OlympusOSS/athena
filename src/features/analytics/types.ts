// Analytics data interfaces exported from hooks
export interface IdentityAnalytics {
	totalIdentities: number;
	newIdentitiesLast30Days: number;
	identitiesByDay: Array<{ date: string; count: number }>;
	identitiesByYear: Array<{ year: number; count: number }>;
	identitiesBySchema: Array<{ schema: string; count: number }>;
	verificationStatus: {
		verified: number;
		unverified: number;
	};
	weekOverWeekGrowth: {
		currentWeekCount: number;
		previousWeekCount: number;
		percentageChange: number;
		direction: "up" | "down" | "flat";
	};
	recentSignups: Array<{
		id: string;
		timestamp: string;
		email: string;
		schemaId: string;
	}>;
	registrationsByWeek: number[];
	totalGrowth4Weeks: number;
}

export interface SessionAnalytics {
	totalSessions: number;
	activeSessions: number;
	sessionsByDay: Array<{ date: string; count: number }>;
	averageSessionDuration: number;
	sessionsLast7Days: number;
	authMethodBreakdown: Array<{ method: string; count: number }>;
	sessionsByHour: Array<{ hour: number; count: number }>;
	recentLogins: Array<{
		id: string;
		timestamp: string;
		email: string;
		method: string;
		identityId: string;
	}>;
	sessionGeoPoints: Array<{ lat: number; lng: number; label: string; count: number }>;
	totalActiveUsers: number;
	activeUsersByYear: Array<{ year: number; count: number }>;
	sessionTimestamps: string[];
}

export interface SystemAnalytics {
	totalSchemas: number;
	systemHealth: "healthy" | "warning" | "error";
	lastUpdated: Date;
}

export interface HydraAnalytics {
	totalClients: number;
	publicClients: number;
	confidentialClients: number;
	clientsByGrantType: Array<{ grantType: string; count: number }>;
	consentSessions: number;
	tokensIssued: number;
	systemHealth: "healthy" | "warning" | "error";
}

export interface CombinedAnalytics {
	identity: {
		data: IdentityAnalytics | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};
	session: {
		data: SessionAnalytics | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};
	system: {
		data: SystemAnalytics | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};
	hydra: {
		data: HydraAnalytics | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};
	isLoading: boolean;
	isError: boolean;
	refetchAll: () => void;
}
