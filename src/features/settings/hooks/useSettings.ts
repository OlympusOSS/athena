import { useEffect, useState } from "react";
import { create } from "zustand";

export interface KratosEndpoints {
	publicUrl: string;
	adminUrl: string;
	apiKey?: string;
}

export interface HydraEndpoints {
	publicUrl: string;
	adminUrl: string;
	apiKey?: string;
}

export interface SettingsStoreState {
	kratosEndpoints: KratosEndpoints;
	hydraEndpoints: HydraEndpoints;
	isOryNetwork: boolean;
	hydraEnabled: boolean;
	defaultClientId: string;
	captchaEnabled: boolean;
	captchaSiteKey: string;
	isReady: boolean;
	setKratosEndpoints: (endpoints: KratosEndpoints) => Promise<void>;
	setHydraEndpoints: (endpoints: HydraEndpoints) => Promise<void>;
	setIsOryNetwork: (value: boolean) => void;
	setHydraEnabled: (value: boolean) => void;
	setDefaultClientId: (id: string) => void;
	resetToDefaults: () => Promise<void>;
	isValidUrl: (url: string) => boolean;
	initialize: () => Promise<void>;
}

// Helper function to encrypt API key via server
async function encryptApiKey(apiKey: string | undefined): Promise<string> {
	if (!apiKey) return "";
	const response = await fetch("/api/encrypt", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ value: apiKey }),
	});
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(`Encryption failed: ${errorData.error || response.statusText}`);
	}
	const data = await response.json();
	if (!data.encrypted) {
		throw new Error("Encryption failed: no encrypted value returned");
	}
	return data.encrypted;
}

async function fetchServerDefaults(): Promise<{
	kratos: KratosEndpoints;
	hydra: HydraEndpoints;
	isOryNetwork: boolean;
	hydraEnabled: boolean;
	defaultClientId: string;
	captchaEnabled: boolean;
	captchaSiteKey: string;
}> {
	try {
		const response = await fetch("/api/config");
		if (response.ok) {
			const config = await response.json();
			return {
				kratos: {
					publicUrl: config.kratosPublicUrl,
					adminUrl: config.kratosAdminUrl,
					apiKey: config.kratosApiKey || undefined,
				},
				hydra: {
					publicUrl: config.hydraPublicUrl || "http://localhost:3102",
					adminUrl: config.hydraAdminUrl || "http://localhost:3103",
					apiKey: config.hydraApiKey || undefined,
				},
				isOryNetwork: config.isOryNetwork || false,
				hydraEnabled: config.hydraEnabled ?? true,
				defaultClientId: config.defaultClientId || "",
				captchaEnabled: config.captchaEnabled || false,
				captchaSiteKey: config.captchaSiteKey || "",
			};
		}
	} catch (error) {
		console.warn("Failed to fetch server config:", error);
	}

	// Fallback to localhost
	return {
		kratos: {
			publicUrl: "http://localhost:3100",
			adminUrl: "http://localhost:3101",
		},
		hydra: {
			publicUrl: "http://localhost:3102",
			adminUrl: "http://localhost:3103",
		},
		isOryNetwork: false,
		hydraEnabled: true,
		defaultClientId: "",
		captchaEnabled: false,
		captchaSiteKey: "",
	};
}

// Initial state - empty until initialized
const INITIAL_KRATOS_ENDPOINTS: KratosEndpoints = {
	publicUrl: "",
	adminUrl: "",
};

const INITIAL_HYDRA_ENDPOINTS: HydraEndpoints = {
	publicUrl: "",
	adminUrl: "",
};

export const useSettingsStore = create<SettingsStoreState>()((set, get) => ({
	kratosEndpoints: INITIAL_KRATOS_ENDPOINTS,
	hydraEndpoints: INITIAL_HYDRA_ENDPOINTS,
	isOryNetwork: false,
	hydraEnabled: true,
	defaultClientId: "",
	captchaEnabled: false,
	captchaSiteKey: "",
	isReady: false,

	initialize: async () => {
		// Already initialized
		if (get().isReady) return;

		// Fetch config from server (env vars / SDK vault only)
		const defaults = await fetchServerDefaults();

		set({
			kratosEndpoints: defaults.kratos,
			hydraEndpoints: defaults.hydra,
			isOryNetwork: defaults.isOryNetwork,
			hydraEnabled: defaults.hydraEnabled,
			defaultClientId: defaults.defaultClientId,
			captchaEnabled: defaults.captchaEnabled,
			captchaSiteKey: defaults.captchaSiteKey,
			isReady: true,
		});
	},

	setKratosEndpoints: async (endpoints: KratosEndpoints) => {
		const encryptedApiKey = endpoints.apiKey ? await encryptApiKey(endpoints.apiKey) : "";
		const storedEndpoints = {
			publicUrl: endpoints.publicUrl,
			adminUrl: endpoints.adminUrl,
			apiKey: encryptedApiKey || undefined,
		};

		set({ kratosEndpoints: storedEndpoints });
	},

	setHydraEndpoints: async (endpoints: HydraEndpoints) => {
		const encryptedApiKey = endpoints.apiKey ? await encryptApiKey(endpoints.apiKey) : "";
		const storedEndpoints = {
			publicUrl: endpoints.publicUrl,
			adminUrl: endpoints.adminUrl,
			apiKey: encryptedApiKey || undefined,
		};

		set({ hydraEndpoints: storedEndpoints });
	},

	setIsOryNetwork: (value: boolean) => {
		set({ isOryNetwork: value });
	},

	setHydraEnabled: (value: boolean) => {
		set({ hydraEnabled: value });
	},

	setDefaultClientId: (id: string) => {
		set({ defaultClientId: id });
	},

	resetToDefaults: async () => {
		const defaults = await fetchServerDefaults();

		set({
			kratosEndpoints: defaults.kratos,
			hydraEndpoints: defaults.hydra,
			isOryNetwork: defaults.isOryNetwork,
			hydraEnabled: defaults.hydraEnabled,
			defaultClientId: defaults.defaultClientId,
		});
	},

	isValidUrl: (url: string) => {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	},
}));

// Hook to initialize settings and wait until ready
export const useSettingsReady = () => {
	const [isReady, setIsReady] = useState(false);
	const storeReady = useSettingsStore((state) => state.isReady);
	const initialize = useSettingsStore((state) => state.initialize);

	useEffect(() => {
		if (!storeReady) {
			initialize();
		} else {
			setIsReady(true);
		}
	}, [storeReady, initialize]);

	return isReady;
};

// Convenience hooks
export const useKratosEndpoints = () => useSettingsStore((state) => state.kratosEndpoints);
export const useHydraEndpoints = () => useSettingsStore((state) => state.hydraEndpoints);
export const useIsOryNetwork = () => useSettingsStore((state) => state.isOryNetwork);
export const useHydraEnabled = () => useSettingsStore((state) => state.hydraEnabled);
export const useSetKratosEndpoints = () => useSettingsStore((state) => state.setKratosEndpoints);
export const useSetHydraEndpoints = () => useSettingsStore((state) => state.setHydraEndpoints);
export const useSetIsOryNetwork = () => useSettingsStore((state) => state.setIsOryNetwork);
export const useSetHydraEnabled = () => useSettingsStore((state) => state.setHydraEnabled);
export const useDefaultClientId = () => useSettingsStore((state) => state.defaultClientId);
export const useSetDefaultClientId = () => useSettingsStore((state) => state.setDefaultClientId);
export const useResetSettings = () => useSettingsStore((state) => state.resetToDefaults);
export const useIsValidUrl = () => useSettingsStore((state) => state.isValidUrl);
export const useCaptchaEnabled = () => useSettingsStore((state) => state.captchaEnabled);
export const useCaptchaSiteKey = () => useSettingsStore((state) => state.captchaSiteKey);

// Backwards compatibility - useSettingsLoaded now uses the same logic as isReady
export const useSettingsLoaded = () => useSettingsStore((state) => state.isReady);
