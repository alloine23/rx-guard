import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password", "/api/auth", "/api/health", "/verify", "/api/verify"];
const ROLE_PREFIXES = [
  "/superadmin",
  "/admin",
  "/doctor",
  "/pharmacist",
  "/patient",
];

function getDashboard(role: string): string {
  return `/${role}/dashboard`;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Skip public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    // If authenticated user visits /login, redirect to dashboard
    if (pathname === "/login" && req.auth?.user) {
      return NextResponse.redirect(
        new URL(getDashboard(req.auth.user.role), req.url)
      );
    }
    return NextResponse.next();
  }

  // No session → login
  if (!req.auth?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { role, forcePasswordChange } = req.auth.user;

  // Force password change
  if (forcePasswordChange && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  // Role-based route guard
  const matchedPrefix = ROLE_PREFIXES.find((prefix) =>
    pathname.startsWith(prefix)
  );
  if (matchedPrefix && matchedPrefix !== `/${role}`) {
    return NextResponse.redirect(new URL(getDashboard(role), req.url));
  }

  // Root redirect
  if (pathname === "/") {
    return NextResponse.redirect(new URL(getDashboard(role), req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
