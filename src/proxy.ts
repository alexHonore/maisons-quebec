import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorizeAdminRequest, ADMIN_COOKIE_NAME, renderAdminRefusalDocument } from "@/server/admin-access";
import { adminPathRequiresSession } from "@/server/admin-gate";
import { recordPageView, shouldRecordRequest } from "@/server/page-views";
import { settingsDatabase } from "@/server/public-site";

function continueWithPath(request: NextRequest, pathname: string) {
  const headers = new Headers(request.headers);
  headers.set("x-mq-path", pathname);
  if (shouldRecordRequest({
    method: request.method,
    path: pathname,
    accept: request.headers.get("accept") ?? "",
    prefetch: request.headers.get("next-router-prefetch"),
    rsc: request.headers.get("rsc"),
    phase: process.env.NEXT_PHASE,
  })) {
    try {
      recordPageView(settingsDatabase(process.env), pathname, new Date());
    } catch {
      // La page reste servie si l'écriture de la vue échoue.
    }
  }
  return NextResponse.next({ request: { headers } });
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  if (!adminPathRequiresSession(pathname)) {
    return continueWithPath(request, pathname);
  }

  const decision = await authorizeAdminRequest({
    secret: process.env.ADMIN_SESSION_SECRET,
    cookieValue: request.cookies.get(ADMIN_COOKIE_NAME)?.value,
    now: new Date(),
  });

  if (decision.allowed) {
    return continueWithPath(request, pathname);
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
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};
