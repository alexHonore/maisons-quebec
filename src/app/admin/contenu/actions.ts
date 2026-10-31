"use server";

import { forbidden, redirect, unauthorized } from "next/navigation";
import { restoreContentVersion, saveContentDraft, setContentPublished } from "@/server/content-pages";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

function fields(formData: FormData) {
  return {
    slug: String(formData.get("slug") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    body: String(formData.get("body") ?? ""),
    sourceNote: String(formData.get("source_note") ?? ""),
    example: formData.get("example") === "on",
  };
}

export async function saveContentDraftAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "content.write")) forbidden();
  const id = String(formData.get("id") ?? "");
  const result = saveContentDraft(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    id: id === "" ? null : id,
    ...fields(formData),
    now: new Date(),
  });
  if (!result.ok) redirect(`/admin/contenu${id === "" ? "" : `/${id}`}?erreur=${result.reason}`);
  redirect(`/admin/contenu/${result.id}?enregistre=1`);
}

export async function setContentPublishedAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "content.publish")) forbidden();
  const id = String(formData.get("id") ?? "");
  const result = setContentPublished(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    id,
    published: formData.get("published") === "1",
    now: new Date(),
  });
  redirect(result.ok ? `/admin/contenu/${id}?enregistre=1` : `/admin/contenu/${id}?erreur=${result.reason}`);
}

export async function restoreContentVersionAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "content.publish")) forbidden();
  const id = String(formData.get("id") ?? "");
  const versionNumber = Number(formData.get("version_number") ?? "");
  const result = restoreContentVersion(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    pageId: id,
    versionNumber,
    now: new Date(),
  });
  redirect(result.ok ? `/admin/contenu/${id}?enregistre=1` : `/admin/contenu/${id}?erreur=${result.reason}`);
}
