import type { Metadata } from "next";
import Link from "next/link";
import { unauthorized } from "next/navigation";
import { ADMIN_ROLE_LABELS } from "@/server/admin-access";
import { readCurrentAdmin } from "@/server/current-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

const GAP_TEXT = {
  mfa_not_enforced: "Seul le mot de passe a été vérifié. Le secret TOTP est vide : le second facteur n'est pas actif.",
  rbac_not_enforced: "Le rôle reconnu ne limite aucune action. Le contrôle par rôle n'est pas en place.",
  no_persistent_user_store: "Le compte d'amorçage vit dans les variables d'environnement. Il n'y a pas de base d'utilisateurs.",
} as const;

export default async function AdminPage() {
  const decision = await readCurrentAdmin();
  if (!decision.allowed) unauthorized();

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Administration</h1>
      <p>
        Session reconnue pour {decision.session.subject}. Rôle indiqué : {ADMIN_ROLE_LABELS[decision.session.role]}.
        {decision.session.mfaSatisfied
          ? " Le code TOTP a été vérifié pour cette session."
          : " Cette session n'est pas multifacteur."}
      </p>
      <h2>Limites actuelles</h2>
      <ul>
        {decision.gaps.map((gap) => (
          <li key={gap}>{GAP_TEXT[gap]}</li>
        ))}
      </ul>
      <p>Les leads, les contenus et les webhooks ne sont pas disponibles.</p>
      <p>
        <Link href="/admin/settings">Modifier les réglages du site</Link>
      </p>
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
