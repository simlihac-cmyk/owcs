import { NextRequest, NextResponse } from "next/server";
import { getAdminAuthConfig, isAuthorizedAdminRequest } from "@/lib/server/admin-auth";

function unauthorizedResponse(configured: boolean) {
  return new NextResponse(
    configured
      ? "Authentication required."
      : "Admin auth is not configured on this deployment.",
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="OWCS Admin", charset="UTF-8"',
        "Cache-Control": "no-store"
      }
    }
  );
}

export function middleware(request: NextRequest) {
  const config = getAdminAuthConfig();

  if (!config.enabled) {
    return NextResponse.next();
  }

  if (!config.username || !config.password) {
    return unauthorizedResponse(false);
  }

  if (!isAuthorizedAdminRequest(request.headers.get("authorization"))) {
    return unauthorizedResponse(true);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};
