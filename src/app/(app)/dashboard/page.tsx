"use client";

import {
	Alert,
	AlertDescription,
	AnimatedAreaChart,
	AnimatedPieChart,
	Button,
	ChartCard,
	ErrorState,
	Icon,
	LoadingState,
	StatCard,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
	VerificationGauge,
} from "@olympusoss/canvas";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { PageHeader, ProtectedPage } from "@/components/layout";
import { useAnalytics } from "@/features/analytics/hooks";
import { UserRole } from "@/features/auth";
import { useFormatters } from "@/hooks";
import { parseError } from "@/utils/errors";

export default function Dashboard() {
	const { identity, session, system, hydra, isLoading, isError, isHydraAvailable, hydraEnabled, refetchAll } = useAnalytics();
	const { formatNumber, formatDuration } = useFormatters();
	const router = useRouter();

	const sessionDays = useMemo(
		() =>
			session.data?.sessionsByDay?.map((item) =>
				new Date(item.date).toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
				}),
			) || [],
		[session.data?.sessionsByDay],
	);

	const sessionValues = useMemo(() => session.data?.sessionsByDay?.map((item) => item.count) || [], [session.data?.sessionsByDay]);

	const identityDays = useMemo(
		() =>
			identity.data?.identitiesByDay?.map((item) =>
				new Date(item.date).toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
				}),
			) || [],
		[identity.data?.identitiesByDay],
	);

	const identityValues = useMemo(() => identity.data?.identitiesByDay?.map((item) => item.count) || [], [identity.data?.identitiesByDay]);

	const verificationRate = useMemo(() => {
		if (!identity.data) return 0;
		const { verified, unverified } = identity.data.verificationStatus;
		return Math.round((verified / (verified + unverified)) * 100);
	}, [identity.data]);

	if (isLoading) {
		return <LoadingState variant="page" message="Loading analytics data..." />;
	}

	if (isError) {
		const firstError = identity.error || session.error || system.error || hydra.error;
		const parsedError = parseError(firstError);

		return (
			<ProtectedPage requiredRole={UserRole.VIEWER}>
				<ErrorState
					variant="page"
					title={parsedError.title}
					message={parsedError.message}
					action={
						parsedError.canRetry
							? {
									label: "Retry",
									onClick: refetchAll,
									icon: <Icon name="refresh" />,
								}
							: undefined
					}
					secondaryAction={
						parsedError.suggestSettings
							? {
									label: "Check Settings",
									onClick: () => router.push("/settings"),
									icon: <Icon name="settings" />,
								}
							: undefined
					}
				/>
			</ProtectedPage>
		);
	}

	// Prepare chart data
	const identityChartData = identityDays.map((label, i) => ({
		label,
		value: identityValues[i] ?? 0,
	}));

	const sessionChartData = sessionDays.map((label, i) => ({
		label,
		value: sessionValues[i] ?? 0,
	}));

	const schemasPieData = (identity.data?.identitiesBySchema || []).map((item) => ({
		name: item.schema.length > 20 ? `${item.schema.slice(0, 20)}...` : item.schema,
		value: item.count,
	}));

	const oauthClientTypesPieData = [
		{ name: "Public", value: hydra.data?.publicClients || 0 },
		{ name: "Confidential", value: hydra.data?.confidentialClients || 0 },
	];

	const grantTypesPieData = (hydra.data?.clientsByGrantType || []).map((item) => ({
		name: item.grantType.length > 20 ? `${item.grantType.slice(0, 20)}...` : item.grantType,
		value: item.count,
	}));

	return (
		<ProtectedPage requiredRole={UserRole.VIEWER}>
			<PageHeader
				title="Analytics Dashboard"
				subtitle={isHydraAvailable ? "Insights and metrics for your Ory Kratos and Hydra systems" : "Insights and metrics for your Ory Kratos system"}
				actions={
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="icon" onClick={refetchAll} aria-label="Refresh data">
									<Icon name="refresh" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Refresh Data</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				}
			/>

			{/* Hydra not available info banner */}
			{!isHydraAvailable && (
				<Alert>
					<Icon name="info" />
					<AlertDescription>
						{!hydraEnabled
							? "Hydra integration is disabled. Enable it in Settings to view OAuth2 analytics."
							: "Hydra is not available. OAuth2 analytics are hidden. Check your Hydra configuration in Settings."}
					</AlertDescription>
				</Alert>
			)}

			{/* Key Metrics Cards */}
			<div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				<StatCard
					index={0}
					colorVariant="primary"
					title="Total Users"
					value={formatNumber(identity.data?.totalIdentities || 0)}
					subtitle={`+${identity.data?.newIdentitiesLast30Days || 0} in last 30 days`}
					icon={<Icon name="users" />}
				/>

				<StatCard
					index={1}
					colorVariant="blue"
					title="Active Sessions"
					value={formatNumber(session.data?.activeSessions || 0)}
					subtitle={`${session.data?.sessionsLast7Days || 0} in last 7 days`}
					icon={<Icon name="shield" />}
				/>

				<StatCard
					index={2}
					colorVariant="purple"
					title="Avg Session"
					value={formatDuration(session.data?.averageSessionDuration || 0)}
					subtitle="Average duration"
					icon={<Icon name="time" />}
				/>

				<StatCard index={3} colorVariant="warning" title="Verification Rate" value={`${verificationRate}%`} subtitle="Email verified users" icon={<Icon name="verified" />} />

				<StatCard
					index={4}
					title="Identity Schemas"
					value={formatNumber(system.data?.totalSchemas || 0)}
					subtitle="Total schemas configured"
					icon={<Icon name="workflow" />}
				/>

				<StatCard
					index={5}
					colorVariant="success"
					title="Kratos Health"
					value={system.data?.systemHealth === "healthy" ? "\u2713 Healthy" : system.data?.systemHealth || "Unknown"}
					subtitle={system.data?.systemHealth || "Unknown"}
					icon={<Icon name="health" />}
				/>

				{/* Hydra Metrics */}
				{isHydraAvailable && (
					<>
						<StatCard
							index={6}
							colorVariant="blue"
							title="OAuth2 Clients"
							value={formatNumber(hydra.data?.totalClients || 0)}
							subtitle={`${hydra.data?.publicClients || 0} public, ${hydra.data?.confidentialClients || 0} confidential`}
							icon={<Icon name="app" />}
						/>

						<StatCard
							index={7}
							colorVariant="purple"
							title="Grant Types"
							value={hydra.data?.clientsByGrantType.length || 0}
							subtitle="Different grant types in use"
							icon={<Icon name="key-round" />}
						/>

						<StatCard
							index={8}
							colorVariant="success"
							title="Hydra Health"
							value={hydra.data?.systemHealth === "healthy" ? "\u2713 Healthy" : hydra.data?.systemHealth === "error" ? "\u2717 Error" : "Unknown"}
							subtitle={hydra.data?.systemHealth || "Unknown"}
							icon={<Icon name="cloud" />}
						/>
					</>
				)}
			</div>

			{/* Charts Section */}
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				{/* User Growth Chart */}
				<div className="md:col-span-2">
					<ChartCard title="New User Registrations (Last 30 Days)">
						<AnimatedAreaChart data={identityChartData} height={350} color="chart-1" gradientId="identityAreaGradient" />
					</ChartCard>
				</div>

				{/* Identity Schema Distribution */}
				<div>
					<ChartCard title="Users by Schema">
						<AnimatedPieChart data={schemasPieData} height={350} innerRadius={40} outerRadius={100} />
					</ChartCard>
				</div>

				{/* Session Activity Chart */}
				<div>
					<ChartCard title="Session Activity (Last 7 Days)">
						<AnimatedAreaChart data={sessionChartData} height={350} color="chart-2" gradientId="sessionAreaGradient" />
					</ChartCard>
				</div>

				{/* Verification Status */}
				<div>
					<ChartCard title="Email Verification Rate">
						<div className="flex items-center justify-center py-4">
							<VerificationGauge
								value={verificationRate}
								size={280}
								label={`${identity.data?.verificationStatus.verified || 0} verified of ${(identity.data?.verificationStatus.verified || 0) + (identity.data?.verificationStatus.unverified || 0)} total users`}
							/>
						</div>
					</ChartCard>
				</div>

				{/* OAuth2 Charts */}
				{isHydraAvailable && (
					<>
						<div>
							<ChartCard title="OAuth2 Client Types">
								<AnimatedPieChart data={oauthClientTypesPieData} height={350} innerRadius={40} outerRadius={100} />
							</ChartCard>
						</div>

						<div>
							<ChartCard title="OAuth2 Grant Types Usage">
								<AnimatedPieChart data={grantTypesPieData} height={350} innerRadius={60} outerRadius={120} />
							</ChartCard>
						</div>
					</>
				)}
			</div>
		</ProtectedPage>
	);
}
