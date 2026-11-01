import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorizeAdminRequest, ADMIN_COOKIE_NAME, renderAdminRefusalDocument } from "@/server/admin-access";
import { adminPathRequiresSession } from "@/server/admin-gate";
import { resolvePublishedRedirect } from "@/server/content-redirects";
import { recordPublicVisit, SESSION_COOKIE, shouldRecordRequest, VISITOR_COOKIE, VISITOR_MAX_AGE_SECONDS } from "@/server/page-views";
import { settingsDatabase } from "@/server/public-site";

function continueWithPath(request: NextRequest, pathname: string) {
  const headers = new Headers(request.headers);
  headers.set("x-mq-path", pathname);
  const response = NextResponse.next({ request: { headers } });
  if (shouldRecordRequest({
    method: request.method,
    path: pathname,
    accept: request.headers.get("accept") ?? "",
    prefetch: request.headers.get("next-router-prefetch"),
    rsc: request.headers.get("rsc"),
    phase: process.env.NEXT_PHASE,
  })) {
    try {
      const recorded = recordPublicVisit(settingsDatabase(process.env), {
        path: pathname,
        visitorCookie: request.cookies.get(VISITOR_COOKIE)?.value,
        sessionCookie: request.cookies.get(SESSION_COOKIE)?.value,
      });
      if (recorded.ok) {
        const secure = request.nextUrl.protocol === "https:";
        response.cookies.set(VISITOR_COOKIE, recorded.visitorId, {
          httpOnly: true,
          sameSite: "lax",
          secure,
          path: "/",
          maxAge: VISITOR_MAX_AGE_SECONDS,
        });
        if (recorded.startSession) {
          response.cookies.set(SESSION_COOKIE, recorded.sessionId, {
            httpOnly: true,
            sameSite: "lax",
            secure,
            path: "/",
          });
        }
      }
    } catch {
      // La page reste servie si l'écriture de la vue échoue.
    }
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  if (!adminPathRequiresSession(pathname)) {
    if (request.method === "GET" || request.method === "HEAD") {
      const redirect = resolvePublishedRedirect(settingsDatabase(process.env), pathname);
      if (redirect) {
        const url = request.nextUrl.clone();
        url.pathname = redirect.pathname;
        url.search = "";
        return NextResponse.redirect(url, redirect.status);
      }
    }
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
