import { useQuery } from "@tanstack/react-query";

interface GitHubRelease {
	tagName: string;
	version: string;
	htmlUrl: string;
	publishedAt: string;
	name: string;
}

export interface ServiceVersionInfo {
	runningVersion: string | null;
	latestRelease: GitHubRelease | null;
	updateAvailable: boolean;
	isLoading: boolean;
	error: Error | null;
}

export interface UseGitHubReleasesReturn {
	kratos: ServiceVersionInfo;
	hydra: ServiceVersionInfo;
}

/** Simple semver comparison — returns true if a > b */
function isNewerVersion(a: string, b: string): boolean {
	const clean = (v: string) => v.replace(/^v/, "");
	const partsA = clean(a).split(".").map(Number);
	const partsB = clean(b).split(".").map(Number);

	for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
		const numA = partsA[i] || 0;
		const numB = partsB[i] || 0;
		if (Number.isNaN(numA) || Number.isNaN(numB)) return false;
		if (numA > numB) return true;
		if (numA < numB) return false;
	}
	return false;
}

async function fetchLatestRelease(repo: string): Promise<GitHubRelease> {
	const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
		headers: { Accept: "application/vnd.github.v3+json" },
	});

	if (!response.ok) {
		throw new Error(`GitHub API error: ${response.status}`);
	}

	const data = await response.json();
	return {
		tagName: data.tag_name,
		version: data.tag_name.replace(/^v/, ""),
		htmlUrl: data.html_url,
		publishedAt: data.published_at,
		name: data.name || data.tag_name,
	};
}

export function useGitHubReleases(hydraEnabled: boolean): UseGitHubReleasesReturn {
	// Fetch latest GitHub releases
	const kratosRelease = useQuery({
		queryKey: ["github-release", "ory/kratos"],
		queryFn: () => fetchLatestRelease("ory/kratos"),
		staleTime: 30 * 60 * 1000, // 30 minutes
		refetchInterval: 60 * 60 * 1000, // 1 hour
		refetchOnWindowFocus: false,
		retry: 1,
	});

	const hydraRelease = useQuery({
		queryKey: ["github-release", "ory/hydra"],
		queryFn: () => fetchLatestRelease("ory/hydra"),
		enabled: hydraEnabled,
		staleTime: 30 * 60 * 1000,
		refetchInterval: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
	});

	// Fetch running versions via server-side health route (uses internal network URLs)
	const serviceVersions = useQuery({
		queryKey: ["service-versions"],
		queryFn: async () => {
			const res = await fetch("/api/services/health");
			if (!res.ok) return null;
			return res.json() as Promise<{ kratos?: { version: string | null }; hydra?: { version: string | null } }>;
		},
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const kratosVersion = { data: serviceVersions.data?.kratos?.version ?? undefined, isLoading: serviceVersions.isLoading, error: serviceVersions.error };
	const hydraVersion = { data: serviceVersions.data?.hydra?.version ?? undefined, isLoading: serviceVersions.isLoading, error: serviceVersions.error };

	const kratosRunning = kratosVersion.data ?? null;
	const hydraRunning = hydraVersion.data ?? null;
	const kratosLatest = kratosRelease.data ?? null;
	const hydraLatest = hydraRelease.data ?? null;

	return {
		kratos: {
			runningVersion: kratosRunning,
			latestRelease: kratosLatest,
			updateAvailable: kratosRunning && kratosLatest ? isNewerVersion(kratosLatest.version, kratosRunning) : false,
			isLoading: kratosRelease.isLoading || kratosVersion.isLoading,
			error: kratosRelease.error || kratosVersion.error || null,
		},
		hydra: {
			runningVersion: hydraRunning,
			latestRelease: hydraLatest,
			updateAvailable: hydraRunning && hydraLatest ? isNewerVersion(hydraLatest.version, hydraRunning) : false,
			isLoading: hydraRelease.isLoading || hydraVersion.isLoading,
			error: hydraRelease.error || hydraVersion.error || null,
		},
	};
}
