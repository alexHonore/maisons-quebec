"use server";

import { forbidden, redirect, unauthorized } from "next/navigation";
import { requestImageProvider } from "@/domain/media-asset";
import { attachMediaToPage, mediaDirectory, saveMediaAsset } from "@/server/media-library";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export async function saveMediaAssetAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "media.manage")) forbidden();
  const entry = formData.get("file");
  const file = entry instanceof File && entry.size > 0 ? new Uint8Array(await entry.arrayBuffer()) : null;
  const result = saveMediaAsset(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    title: String(formData.get("title") ?? ""),
    license: String(formData.get("license") ?? ""),
    author: String(formData.get("author") ?? ""),
    source: String(formData.get("source") ?? ""),
    now: new Date(),
    file,
    directory: mediaDirectory(process.env),
  });
  if (!result.ok) redirect(`/admin/medias?erreur=${result.reason}`);
  redirect(result.storedFile ? "/admin/medias?enregistre=fichier" : "/admin/medias?enregistre=1");
}

export async function attachMediaAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "media.manage")) forbidden();
  const result = attachMediaToPage(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    pageId: String(formData.get("page_id") ?? ""),
    assetId: String(formData.get("asset_id") ?? ""),
    now: new Date(),
  });
  redirect(result.ok ? "/admin/medias?associe=1" : `/admin/medias?erreur=${result.reason}`);
}

function providerRedirect(apiKey: string | undefined): never {
  const result = requestImageProvider({ apiKey });
  redirect(result.message === "à connecter" ? "/admin/medias?fournisseur=a-connecter" : "/admin/medias?fournisseur=non-branche");
}

export async function searchPexelsAction() {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "media.manage")) forbidden();
  providerRedirect(process.env.PEXELS_API_KEY);
}

export async function searchUnsplashAction() {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "media.manage")) forbidden();
  providerRedirect(process.env.UNSPLASH_ACCESS_KEY);
}

export async function generateImageAction() {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "media.manage")) forbidden();
  providerRedirect(process.env.IMAGE_GENERATION_API_KEY);
}
