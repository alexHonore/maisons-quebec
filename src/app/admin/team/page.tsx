import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { createAdminAccountAction, disableAdminAccountAction } from "./actions";
import { ADMIN_ROLE_LABELS, ADMIN_ROLES } from "@/server/admin-access";
import { countOwners, listAdminAccounts } from "@/server/admin-accounts";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Comptes",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  forbidden: "Action refusée.",
  bootstrap_required: "Le premier propriétaire doit encore être créé par la connexion d'amorçage.",
  email_invalid: "Courriel refusé.",
  email_taken: "Ce courriel existe déjà.",
  password_too_short: "Mot de passe trop court. Aucun compte n'a été créé.",
  role_invalid: "Rôle refusé.",
  missing: "Compte introuvable.",
  last_owner: "Le dernier propriétaire actif ne peut pas être désactivé.",
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string; erreur?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "users.manage")) forbidden();
  const params = await searchParams;
  const db = settingsDatabase(process.env);
  const accounts = listAdminAccounts(db);
  const owners = countOwners(db);

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Comptes</h1>
      <p>Le premier propriétaire vient de la connexion d&apos;amorçage. Les comptes suivants sont enregistrés ici. Les mots de passe ne sont pas affichés.</p>
      {params.enregistre === "1" ? <p role="status">Modification enregistrée.</p> : null}
      {params.erreur ? <p role="alert">{ERRORS[params.erreur] ?? "Modification refusée."}</p> : null}
      <ul className="plain-list">
        {accounts.map((account) => (
          <li key={account.id}>
            {account.email} — {ADMIN_ROLE_LABELS[account.role]}
            {account.disabled ? " — désactivé" : ""}
            {!account.disabled && !(account.role === "owner" && owners <= 1) ? (
              <form action={disableAdminAccountAction}>
                <input type="hidden" name="id" value={account.id} />
                <button className="button" type="submit">
                  Désactiver
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      <h2>Nouveau compte</h2>
      <form className="form-grid" action={createAdminAccountAction}>
        <label>
          Courriel
          <input name="email" type="email" autoComplete="off" required />
        </label>
        <label>
          Mot de passe
          <input name="password" type="password" autoComplete="new-password" required />
        </label>
        <label>
          Rôle
          <select name="role" defaultValue="editor">
            {ADMIN_ROLES.map((role) => (
              <option key={role} value={role}>
                {ADMIN_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Créer le compte</button>
      </form>
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
