import { buildHomeContent, type HomeContent } from "../content/home";
import { resolveRegulatoryIdentity, type RegulatoryIdentity } from "../domain/regulatory-identity";
import { DatabaseSync } from "node:sqlite";
import { openSettingsDatabase, readStoredSettings, settingsFilePath } from "./settings-db";

const openDatabases = new Map<string, DatabaseSync>();

export function settingsDatabase(env: { readonly [key: string]: string | undefined }): DatabaseSync {
  const filePath = settingsFilePath(env);
  const existing = openDatabases.get(filePath);
  if (existing) return existing;
  const db = openSettingsDatabase(filePath);
  openDatabases.set(filePath, db);
  return db;
}

export function loadPublicSite(env: { readonly [key: string]: string | undefined }): {
  content: HomeContent;
  identity: RegulatoryIdentity;
} {
  const stored = readStoredSettings(settingsDatabase(env));
  const identity = resolveRegulatoryIdentity(
    {
      brokerPermit: stored.broker_oaciq_permit,
      agencyName: stored.agency_name,
      agencyPermit: stored.agency_permit,
    },
    env,
  );
  return {
    identity,
    content: buildHomeContent(identity, {
      brandName: stored.brand_name,
      heroTitle: stored.hero_title,
      heroPromise: stored.hero_promise,
      heroSubpromise: stored.hero_subpromise,
    }),
  };
}
