import { clearAdminCookie } from "@/server/admin-access";

function requestIsSecure(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  return new URL(request.url).protocol === "https:";
}

export function POST(request: Request) {
  const headers = new Headers({
    location: "/admin/login",
    "cache-control": "private, no-store",
    "set-cookie": clearAdminCookie(requestIsSecure(request)),
  });
  return new Response(null, { status: 303, headers });
}
