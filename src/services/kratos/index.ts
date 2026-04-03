// Export all service endpoints

// Export client utilities
export { getAdminApi, getMetadataApi, getPublicApi } from "./client";
// Export configuration utilities
export * from "./config";
export * from "./endpoints/courier";
export * from "./endpoints/health";
export * from "./endpoints/identities";
export * from "./endpoints/schemas";
export * from "./endpoints/sessions";

// Export health check utilities
export { checkKratosHealth } from "./health";

// Export canonical reload helper (athena#89 — DA hard gate for athena#49)
// All Kratos config reload calls MUST go through this helper — not inline Axios calls.
export { reloadKratosConfig, ConfigurationError } from "./reload";
