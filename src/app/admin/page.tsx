import type { Metadata } from "next";
import Link from "next/link";
import { unauthorized } from "next/navigation";
import { ADMIN_ROLE_LABELS } from "@/server/admin-access";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";
import { isPrivilegedAdminRole, renderTotpStatus, totpAccountState } from "@/server/totp-vault";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  const { user } = live;
  const totpText = renderTotpStatus({
    state: totpAccountState(settingsDatabase(process.env), user.id),
    sessionMfa: user.mfaSatisfied,
    globalSecretConfigured: Boolean(process.env.ADMIN_TOTP_SECRET?.trim()),
  });

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Administration</h1>
      <p>
        Session reconnue pour {user.email}. Rôle lu dans la base : {ADMIN_ROLE_LABELS[user.role]}. {totpText}
      </p>
      <p>Les leads et les webhooks ne sont pas disponibles.</p>
      <ul className="nav">
        {roleCan(user.role, "settings.copy.write") || roleCan(user.role, "settings.regulatory.write") ? (
          <li>
            <Link href="/admin/settings">Réglages du site</Link>
          </li>
        ) : null}
        {roleCan(user.role, "users.manage") ? (
          <li>
            <Link href="/admin/team">Comptes</Link>
          </li>
        ) : null}
        {roleCan(user.role, "jobs.read") ? (
          <li>
            <Link href="/admin/jobs">Journal des contrôles</Link>
          </li>
        ) : null}
        {isPrivilegedAdminRole(user.role) ? (
          <li>
            <Link href="/admin/securite">Second facteur</Link>
          </li>
        ) : null}
        {roleCan(user.role, "audit.read") ? (
          <li>
            <Link href="/admin/audit">Journal d&apos;audit</Link>
          </li>
        ) : null}
      </ul>
      <form method="post" action="/admin/logout">
        <button className="button" type="submit">
          Fermer la session
        </button>
      </form>
      <p>
        <Link href="/">Retour à l&apos;accueil</Link>
      </p>
    </main>
  );
}
