import { attemptLogin, renderLoginDocument } from "@/server/admin-login";
import { settingsDatabase } from "@/server/public-site";

function requestIsSecure(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  return new URL(request.url).protocol === "https:";
}

function htmlHeaders(): Headers {
  return new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "private, no-store",
    "x-robots-tag": "noindex, nofollow",
  });
}

export function GET() {
  return new Response(renderLoginDocument({ failed: false, email: "", notice: "" }), {
    status: 200,
    headers: htmlHeaders(),
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const result = await attemptLogin({
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    totpCode: String(form.get("totp") ?? ""),
    now: new Date(),
    secure: requestIsSecure(request),
    env: process.env,
    db: settingsDatabase(process.env),
  });
  const headers = htmlHeaders();
  if (result.ok) {
    headers.set("location", "/admin");
    headers.set("set-cookie", result.cookie);
    return new Response(null, { status: 303, headers });
  }
  return new Response(result.body, { status: 401, headers });
}
