import { recordEngagedSeconds, VISITOR_COOKIE } from "@/server/page-views";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

function visitorCookie(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === VISITOR_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function POST(request: Request) {
  let seconds: unknown;
  try {
    const body = await request.json() as { seconds?: unknown };
    seconds = body.seconds;
  } catch {
    return new Response(null, { status: 400 });
  }
  const saved = recordEngagedSeconds(settingsDatabase(process.env), {
    visitorId: visitorCookie(request.headers.get("cookie")),
    seconds,
  });
  return new Response(null, {
    status: saved ? 204 : 400,
    headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex" },
  });
}
