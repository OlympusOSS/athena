import { type NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";

export async function GET(request: NextRequest) {
	const session = await verifySession(request.cookies.get("athena-session")?.value);

	if (!session) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	return NextResponse.json({
		user: session.user,
	});
}
