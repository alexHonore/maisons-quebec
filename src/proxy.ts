import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorizeAdminRequest, ADMIN_COOKIE_NAME, renderAdminRefusalDocument } from "@/server/admin-access";

export async function proxy(request: NextRequest) {
  const decision = await authorizeAdminRequest({
    secret: process.env.ADMIN_SESSION_SECRET,
    cookieValue: request.cookies.get(ADMIN_COOKIE_NAME)?.value,
    now: new Date(),
  });

  if (decision.allowed) {
    return NextResponse.next();
  }

  return new NextResponse(renderAdminRefusalDocument(), {
    status: 401,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
