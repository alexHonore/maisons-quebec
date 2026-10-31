import { cookies } from "next/headers";
import { findAdminById } from "./admin-accounts";
import { ADMIN_COOKIE_NAME, authorizeAdminRequest, type AdminRole } from "./admin-access";
import { settingsDatabase } from "./public-site";

export type LiveAdmin = {
  readonly id: string;
  readonly email: string;
  readonly role: AdminRole;
  readonly mfaSatisfied: boolean;
};

export async function readLiveAdmin(): Promise<{ ok: false } | { ok: true; user: LiveAdmin }> {
  const jar = await cookies();
  const decision = await authorizeAdminRequest({
    secret: process.env.ADMIN_SESSION_SECRET,
    cookieValue: jar.get(ADMIN_COOKIE_NAME)?.value,
    now: new Date(),
  });
  if (!decision.allowed) return { ok: false };
  const account = findAdminById(settingsDatabase(process.env), decision.session.subject);
  if (!account || account.disabled) return { ok: false };
  return {
    ok: true,
    user: {
      id: account.id,
      email: account.email,
      role: account.role,
      mfaSatisfied: decision.session.mfaSatisfied,
    },
  };
}
