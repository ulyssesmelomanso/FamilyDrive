import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export type UserRole = "admin" | "investor";

const SESSION_COOKIE = "familydrive_session";
const SESSION_HOURS = 12;

type SessionPayload = {
  role: UserRole;
  username: string;
  expiresAt: number;
};

function adminUsername() {
  return process.env.ADMIN_USERNAME || "familydrive";
}

function adminPassword() {
  return process.env.ADMIN_PASSWORD || "familydrive";
}

function investorUsername() {
  return process.env.INVESTOR_USERNAME || "wessiemens";
}

function investorPassword() {
  return process.env.INVESTOR_PASSWORD || "12345";
}

function secret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "local-familydrive-secret";
}

function encodeSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = Buffer.from(`${body}.${secret()}`).toString("base64url");
  return `${body}.${signature}`;
}

function decodeSession(value?: string): SessionPayload | null {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = Buffer.from(`${body}.${secret()}`).toString("base64url");
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.expiresAt || payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function validateLogin(username: string, password: string): SessionPayload | null {
  if (username === adminUsername() && password === adminPassword()) {
    return { role: "admin", username, expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000 };
  }

  if (username === investorUsername() && password === investorPassword()) {
    return { role: "investor", username, expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000 };
  }

  return null;
}

export function getSessionFromRequest(request: NextRequest) {
  return decodeSession(request.cookies.get(SESSION_COOKIE)?.value);
}

export function getCurrentSession() {
  return decodeSession(cookies().get(SESSION_COOKIE)?.value);
}

export function setSessionCookie(response: NextResponse, session: SessionPayload) {
  response.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
