import { type NextRequest, NextResponse } from "next/server";

const iamKratosAdminUrl = process.env.IAM_KRATOS_ADMIN_URL || "http://localhost:4101";

/**
 * Reads the logged-in user's kratosIdentityId from the session cookie.
 */
function getIdentityIdFromSession(request: NextRequest): string | null {
	const sessionCookie = request.cookies.get("athena-session")?.value;
	if (!sessionCookie) return null;

	try {
		const session = JSON.parse(sessionCookie);
		return session.user?.kratosIdentityId || null;
	} catch {
		return null;
	}
}

/**
 * GET /api/dashboard/layout
 *
 * Returns the user's saved dashboard layout from Kratos identity metadata_public.
 * Returns null if no layout is saved.
 */
export async function GET(request: NextRequest) {
	const identityId = getIdentityIdFromSession(request);

	if (!identityId) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	try {
		const res = await fetch(`${iamKratosAdminUrl}/admin/identities/${identityId}`, {
			headers: { Accept: "application/json" },
		});

		if (!res.ok) {
			console.error("Failed to fetch identity:", res.status, await res.text());
			return NextResponse.json({ error: "Failed to fetch identity" }, { status: 500 });
		}

		const identity = await res.json();
		const layout = identity.metadata_public?.dashboardLayout || null;

		return NextResponse.json({ layout });
	} catch (err) {
		console.error("Error fetching dashboard layout:", err);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * PUT /api/dashboard/layout
 *
 * Saves the user's dashboard layout to Kratos identity metadata_public.
 * Preserves any existing metadata_public fields.
 */
export async function PUT(request: NextRequest) {
	const identityId = getIdentityIdFromSession(request);

	if (!identityId) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const newLayout = body.layout;

		if (!newLayout) {
			return NextResponse.json({ error: "Missing layout in request body" }, { status: 400 });
		}

		// Fetch current identity to get existing metadata_public
		const identityRes = await fetch(`${iamKratosAdminUrl}/admin/identities/${identityId}`, {
			headers: { Accept: "application/json" },
		});

		if (!identityRes.ok) {
			console.error("Failed to fetch identity:", identityRes.status);
			return NextResponse.json({ error: "Failed to fetch identity" }, { status: 500 });
		}

		const identity = await identityRes.json();
		const existingMetadata = identity.metadata_public || {};

		// Merge new layout with existing metadata
		const updatedMetadata = {
			...existingMetadata,
			dashboardLayout: newLayout,
		};

		// Update identity via admin API (PUT with full body)
		const updateRes = await fetch(`${iamKratosAdminUrl}/admin/identities/${identityId}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({
				schema_id: identity.schema_id,
				traits: identity.traits,
				metadata_public: updatedMetadata,
				metadata_admin: identity.metadata_admin,
				state: identity.state,
			}),
		});

		if (!updateRes.ok) {
			const errorText = await updateRes.text();
			console.error("Failed to update identity metadata:", updateRes.status, errorText);
			return NextResponse.json({ error: "Failed to save layout" }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (err) {
		console.error("Error saving dashboard layout:", err);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
