import type { AdminRole } from "./admin-access";
import { SETTING_KEYS, type SettingKey } from "./settings-db";

export const ADMIN_PERMISSIONS = {
  "settings.copy.write": ["owner", "editor"],
  "settings.regulatory.write": ["owner"],
  "users.manage": ["owner"],
  "jobs.read": ["owner", "analyst", "automation_manager"],
  "jobs.run_demo": ["owner", "automation_manager"],
  "audit.read": ["owner"],
  "leads.read": ["owner"],
  "leads.aggregate": ["owner", "analyst"],
  "webhooks.manage": ["owner", "integration_manager"],
  "appointments.confirm": ["owner"],
} as const;

export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;

const COPY_KEYS = ["brand_name", "hero_title", "hero_promise", "hero_subpromise"] as const satisfies readonly SettingKey[];
const REGULATORY_KEYS = ["broker_oaciq_permit", "agency_name", "agency_permit"] as const satisfies readonly SettingKey[];

export function roleCan(role: AdminRole, permission: AdminPermission): boolean {
  return (ADMIN_PERMISSIONS[permission] as readonly AdminRole[]).includes(role);
}

function normalized(value: string | undefined): string {
  return (value ?? "").trim();
}

export function planSettingsUpdate(
  role: AdminRole,
  current: Record<SettingKey, string>,
  submitted: Partial<Record<SettingKey, string>>,
): { ok: true; values: Partial<Record<SettingKey, string>> } | { ok: false; status: 403 } {
  const values: Partial<Record<SettingKey, string>> = {};
  const changedCopy = COPY_KEYS.filter((key) => key in submitted && normalized(submitted[key]) !== normalized(current[key]));
  const changedRegulatory = REGULATORY_KEYS.filter(
    (key) => key in submitted && normalized(submitted[key]) !== normalized(current[key]),
  );
  if (changedRegulatory.length > 0 && !roleCan(role, "settings.regulatory.write")) return { ok: false, status: 403 };
  if (changedCopy.length > 0 && !roleCan(role, "settings.copy.write")) return { ok: false, status: 403 };
  if (changedCopy.length === 0 && changedRegulatory.length === 0) {
    const canTouch = roleCan(role, "settings.copy.write") || roleCan(role, "settings.regulatory.write");
    if (!canTouch) return { ok: false, status: 403 };
    return { ok: true, values: {} };
  }
  for (const key of SETTING_KEYS) {
    if (key in submitted) values[key] = submitted[key] ?? "";
  }
  return { ok: true, values };
}
