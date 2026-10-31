import { forbidden, unauthorized } from "next/navigation";
import { readLiveAdmin } from "@/server/current-admin";
import { settingsDatabase } from "@/server/public-site";
import { beginTotpEnrollment, isPrivilegedAdminRole, renderTotpEnrollment, totpKeyFromSessionSecret } from "@/server/totp-vault";

export async function POST() {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!isPrivilegedAdminRole(live.user.role)) forbidden();
  const key = totpKeyFromSessionSecret(process.env.ADMIN_SESSION_SECRET ?? "");
  if (!key) unauthorized();
  const started = beginTotpEnrollment(settingsDatabase(process.env), {
    userId: live.user.id,
    actorRole: live.user.role,
    key,
    now: new Date(),
  });
  if (!started.ok) {
    return new Response("Enrôlement refusé. Le secret n'est pas affiché.", {
      status: started.reason === "not_privileged" ? 403 : 409,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex" },
    });
  }
  const html = `<!DOCTYPE html><html lang="fr-CA"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Secret TOTP</title></head><body><main><h1>Secret à conserver</h1>${renderTotpEnrollment(started.secretBase32)}<p>Cette page ne sera pas réaffichée.</p><p><a href="/admin/securite">Revenir au second facteur</a></p></main></body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
