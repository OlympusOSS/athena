import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const sessionCookie = request.cookies.get("athena-session")?.value;

	if (!sessionCookie) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	try {
		const session = JSON.parse(sessionCookie);

		if (!session.user || !session.accessToken) {
			return NextResponse.json({ error: "Invalid session" }, { status: 401 });
		}

		return NextResponse.json({
			user: session.user,
		});
	} catch {
		return NextResponse.json({ error: "Invalid session" }, { status: 401 });
	}
}
