/**
 * HMAC-signed session cookie utilities.
 *
 * Format: `base64url(json).base64url(hmac-sha256)`
 *
 * Uses the Web Crypto API so it works in both Node.js and Edge runtimes.
 * The HMAC key is derived from the ENCRYPTION_KEY env var (same key the SDK
 * uses for AES-256-GCM encryption of secrets).
 */

/** Shape of the user object stored inside the session cookie. */
export interface SessionUser {
	kratosIdentityId: string;
	email: string;
	role: string;
	displayName: string;
}

/** Full session payload persisted in the athena-session cookie. */
export interface SessionData {
	accessToken: string;
	idToken: string;
	refreshToken: string;
	expiresIn: number;
	user: SessionUser;
}

/**
 * Derive an HMAC-SHA256 CryptoKey from the ENCRYPTION_KEY env var.
 * Throws if the env var is missing.
 */
async function getHmacKey(): Promise<CryptoKey> {
	const secret = process.env.ENCRYPTION_KEY;
	if (!secret) {
		throw new Error("ENCRYPTION_KEY environment variable is required for session signing");
	}

	const encoder = new TextEncoder();
	const keyData = encoder.encode(secret);

	// Derive a fixed 32-byte key via SHA-256 so arbitrary-length env vars work.
	const hash = await crypto.subtle.digest("SHA-256", keyData);

	return crypto.subtle.importKey("raw", hash, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/**
 * Encode bytes to URL-safe base64 (no padding).
 */
function toBase64Url(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = "";
	for (const b of bytes) {
		binary += String.fromCharCode(b);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode URL-safe base64 (no padding) back to an ArrayBuffer.
 */
function fromBase64Url(s: string): ArrayBuffer {
	// Restore standard base64 alphabet + padding
	const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64 + "===".slice(0, (4 - (base64.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

/**
 * Sign a session payload. Returns the cookie value string.
 *
 * Format: `<base64url(json)>.<base64url(hmac)>`
 */
export async function signSession(data: SessionData): Promise<string> {
	const json = JSON.stringify(data);
	const encoder = new TextEncoder();
	const payload = toBase64Url(encoder.encode(json).buffer);

	const key = await getHmacKey();
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));

	return `${payload}.${toBase64Url(sig)}`;
}

/**
 * Verify an HMAC-signed session cookie and return the parsed data.
 * Returns `null` if the cookie is missing, malformed, or the signature
 * does not match.
 */
export async function verifySession(cookie: string | undefined): Promise<SessionData | null> {
	if (!cookie) return null;

	const dotIndex = cookie.lastIndexOf(".");
	if (dotIndex === -1) return null;

	const payload = cookie.slice(0, dotIndex);
	const sig = cookie.slice(dotIndex + 1);

	if (!payload || !sig) return null;

	try {
		const key = await getHmacKey();
		const encoder = new TextEncoder();
		const sigBuf = fromBase64Url(sig);

		const valid = await crypto.subtle.verify("HMAC", key, sigBuf, encoder.encode(payload));
		if (!valid) return null;

		const jsonBuf = fromBase64Url(payload);
		const json = new TextDecoder().decode(jsonBuf);
		const data = JSON.parse(json) as SessionData;

		// Minimum viability check — same as the old parseSession.
		if (!data.accessToken || !data.user?.email || !data.user?.role) {
			return null;
		}

		return data;
	} catch {
		return null;
	}
}
