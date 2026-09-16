import { NextResponse } from "next/server";
import { clearSessionCookie, setSessionCookie, validateLogin } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  const session = validateLogin(String(body.username || ""), String(body.password || ""));
  if (!session) {
    return NextResponse.json({ ok: false, message: "Incorrect username or password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, role: session.role });
  setSessionCookie(response, session);

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
