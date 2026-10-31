import { exportAutomationJson } from "@/server/automations";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const live = await readLiveAdmin();
  if (!live.ok) return new Response("Non autorisé", { status: 401 });
  if (!roleCan(live.user.role, "automations.manage")) return new Response("Interdit", { status: 403 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const result = exportAutomationJson(settingsDatabase(process.env), { actorRole: live.user.role, id });
  if (!result.ok) return new Response("Introuvable", { status: 404 });
  return new Response(result.body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${result.filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
