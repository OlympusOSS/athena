/**
 * CSP (Content-Security-Policy) builder — athena#108
 *
 * Extracted from middleware.ts to enable isolated unit testing.
 *
 * Framing policy ownership (DA/Security condition C3):
 *   - `frame-ancestors 'none'` in the CSP is the AUTHORITATIVE framing policy for Athena.
 *   - `X-Frame-Options: DENY` set by Caddy is the legacy-browser fallback ONLY.
 *   - Future framing policy changes MUST update this function. Changing the Caddyfile alone
 *     has no effect in modern browsers because CSP frame-ancestors takes precedence.
 *
 * `unsafe-inline` in style-src (DA/Security condition C2 / SR-1):
 *   - `'unsafe-inline'` in style-src is a known pragmatic allowance for CSS-in-JS and
 *     Canvas component styles. This is a CSS injection risk (lower-severity than XSS).
 *   - A follow-on ticket tracks removing this allowance via nonce-based styles.
 *
 * `unsafe-eval` policy:
 *   - In dev mode, Next.js HMR/React Refresh requires eval().
 *   - 'unsafe-eval' is ONLY included in development — never in production.
 *   - The NODE_ENV check is the sole gate: process.env.NODE_ENV !== "production".
 */
export function buildCsp(nonce: string): string {
	// In dev mode, Next.js HMR/React Refresh requires eval().
	// 'unsafe-eval' is ONLY included in development — never in production.
	const isDev = process.env.NODE_ENV !== "production";
	const directives = [
		"default-src 'self'",
		`script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
		"style-src 'self' 'unsafe-inline'",
		"connect-src 'self' https://api.github.com",
		"img-src 'self' data:",
		"font-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		// frame-ancestors is authoritative for framing policy — see note above
		"frame-ancestors 'none'",
	];
	return directives.join("; ");
}
