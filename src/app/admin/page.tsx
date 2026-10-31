import type { Metadata } from "next";
import Link from "next/link";
import { unauthorized } from "next/navigation";
import { ADMIN_ROLE_LABELS } from "@/server/admin-access";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  const { user } = live;

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Administration</h1>
      <p>
        Session reconnue pour {user.email}. Rôle lu dans la base : {ADMIN_ROLE_LABELS[user.role]}.
        {user.mfaSatisfied
          ? " Le code TOTP a été vérifié pour cette session."
          : " Cette session n'est pas multifacteur. Le secret TOTP reste celui de l'environnement, pas un secret par compte."}
      </p>
      <p>Les leads et les webhooks ne sont pas disponibles. Le rôle integration_manager n&apos;a aucune action tant que ces écrans n&apos;existent pas.</p>
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
