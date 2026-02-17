import { Configuration, type ConfigurationParameters, CourierApi, IdentityApi, MetadataApi } from "@ory/kratos-client";
import { getKratosAdminUrl, getKratosPublicUrl } from "./config";

// Create configurations for API clients
const getAdminConfiguration = (): Configuration => {
	const defaultConfig: ConfigurationParameters = {};

	return new Configuration({
		...defaultConfig,
		basePath: getKratosAdminUrl(),
	});
};

const getPublicConfiguration = (): Configuration => {
	const defaultConfig: ConfigurationParameters = {};

	return new Configuration({
		...defaultConfig,
		basePath: getKratosPublicUrl(),
		baseOptions: {
			withCredentials: true,
		},
	});
};

// Singleton API clients for performance optimization
let adminApiInstance: IdentityApi | null = null;
let publicApiInstance: IdentityApi | null = null;
let metadataApiInstance: MetadataApi | null = null;
let courierApiInstance: CourierApi | null = null;

// API client getters with singleton pattern
export const getKratosAdminApi = (): IdentityApi => {
	if (!adminApiInstance) {
		adminApiInstance = new IdentityApi(getAdminConfiguration());
	}
	return adminApiInstance;
};

export const getKratosPublicApi = (): IdentityApi => {
	if (!publicApiInstance) {
		publicApiInstance = new IdentityApi(getPublicConfiguration());
	}
	return publicApiInstance;
};

export const getKratosMetadataApi = (): MetadataApi => {
	if (!metadataApiInstance) {
		metadataApiInstance = new MetadataApi(getPublicConfiguration());
	}
	return metadataApiInstance;
};

export const getKratosCourierApi = (): CourierApi => {
	if (!courierApiInstance) {
		courierApiInstance = new CourierApi(getAdminConfiguration());
	}
	return courierApiInstance;
};

// Reset function for testing or configuration changes
export const resetKratosApiClients = (): void => {
	adminApiInstance = null;
	publicApiInstance = null;
	metadataApiInstance = null;
	courierApiInstance = null;
};
