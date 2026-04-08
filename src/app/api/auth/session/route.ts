import { type NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";

export async function GET(request: NextRequest) {
	const session = await verifySession(request.cookies.get("athena-session")?.value);

	if (!session) {
		// athena#60: standardized error shape
		return NextResponse.json(
			{
				error: "not_authenticated",
				message: "Authentication required.",
				hint: "Authenticate via /api/auth/login",
			},
			{ status: 401 },
		);
	}

	return NextResponse.json({
		user: session.user,
	});
}
