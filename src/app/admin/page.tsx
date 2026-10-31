import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { unauthorized } from "next/navigation";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_ROLE_LABELS,
  authorizeAdminRequest,
} from "@/server/admin-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

const GAP_TEXT = {
  mfa_not_enforced: "L'authentification multifacteur n'est pas exigée : aucun fournisseur n'est choisi.",
  rbac_not_enforced: "Le rôle reconnu ne limite aucune action. Le contrôle par rôle n'est pas en place.",
  no_persistent_user_store: "Aucun compte n'est enregistré. Il n'existe pas de base d'utilisateurs.",
} as const;

export default async function AdminPage() {
  const jar = await cookies();
  const decision = await authorizeAdminRequest({
    secret: process.env.ADMIN_SESSION_SECRET,
    cookieValue: jar.get(ADMIN_COOKIE_NAME)?.value,
    now: new Date(),
  });
  if (!decision.allowed) unauthorized();

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Administration</h1>
      <p>
        Session reconnue pour {decision.session.subject}. Rôle indiqué :{" "}
        {ADMIN_ROLE_LABELS[decision.session.role]}. Cette page ne donne accès à aucune donnée.
      </p>
      <h2>Trous assumés</h2>
      <ul>
        {decision.gaps.map((gap) => (
          <li key={gap}>{GAP_TEXT[gap]}</li>
        ))}
      </ul>
      <p>Aucun lead, aucun contenu, aucun webhook et aucun réglage ne sont disponibles.</p>
      <p>
        <Link href="/">Retour à l&apos;accueil</Link>
      </p>
    </main>
  );
}
