import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { listAdminAudit } from "@/server/admin-audit";
import { ADMIN_ROLE_LABELS } from "@/server/admin-access";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit",
  robots: { index: false, follow: false },
};

export default async function AuditPage() {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "audit.read")) forbidden();
  const events = listAdminAudit(settingsDatabase(process.env));

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Journal d&apos;audit</h1>
      <p>Chaque ligne indique un identifiant de compte, un rôle, une action et une date. Elle ne contient ni courriel, ni permis, ni secret.</p>
      {events.length === 0 ? (
        <p>Aucune action enregistrée.</p>
      ) : (
        <ul className="plain-list">
          {events.map((event) => (
            <li key={event.id}>
              {event.at} — {event.action} — {event.actorId} — {ADMIN_ROLE_LABELS[event.actorRole]}
              {event.subjectId ? ` — sujet ${event.subjectId}` : ""}
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
