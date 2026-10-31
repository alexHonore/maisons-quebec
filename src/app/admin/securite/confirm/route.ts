import { forbidden, unauthorized } from "next/navigation";
import { readLiveAdmin } from "@/server/current-admin";
import { settingsDatabase } from "@/server/public-site";
import { confirmTotpEnrollment, isPrivilegedAdminRole, totpKeyFromSessionSecret } from "@/server/totp-vault";

export async function POST(request: Request) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!isPrivilegedAdminRole(live.user.role)) forbidden();
  const key = totpKeyFromSessionSecret(process.env.ADMIN_SESSION_SECRET ?? "");
  if (!key) unauthorized();
  const form = await request.formData();
  const result = confirmTotpEnrollment(settingsDatabase(process.env), {
    userId: live.user.id,
    actorRole: live.user.role,
    key,
    code: String(form.get("totp") ?? ""),
    now: new Date(),
  });
  const location = result.ok ? "/admin/securite?confirme=1" : "/admin/securite?erreur=code";
  return new Response(null, { status: 303, headers: { location, "cache-control": "private, no-store" } });
}
