import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { confirmAppointmentAction } from "@/app/admin/leads/actions";
import { funnelLabel } from "@/domain/honest-funnels";
import { deliveryLabel, leadVisibility, listLeadAggregates, listLeadsForOwner, type AppointmentStatus } from "@/server/acquisition";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demandes",
  robots: { index: false, follow: false },
};

function appointmentLabel(status: AppointmentStatus): string {
  if (status === "requested") return "demandé";
  if (status === "confirmed") return "confirmé";
  return "aucun";
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; confirme?: string }>;
}) {
  const params = await searchParams;
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  const visibility = leadVisibility(live.user.role);
  if (visibility === "none") forbidden();
  const db = settingsDatabase(process.env);
  const full = visibility === "full" ? listLeadsForOwner(db) : null;
  const aggregate = full ? null : listLeadAggregates(db);
  const count = full ? full.length : aggregate!.length;
  const canConfirm = roleCan(live.user.role, "appointments.confirm");

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Demandes</h1>
      <p>
        {full
          ? "Les coordonnées sont visibles pour le propriétaire seulement. Un rendez-vous n'est confirmé que si vous saisissez un créneau réel."
          : "Cette vue indique le nombre, l'outil et l'état du rendez-vous. Elle ne montre ni nom, ni courriel, ni plage demandée."}
      </p>
      {params.confirme === "1" ? <p role="status">Le créneau est confirmé. L&apos;envoi de l&apos;événement peut rester en attente.</p> : null}
      {params.erreur === "creneau" ? <p role="alert">Ce créneau n&apos;est pas utilisable. Le libellé vide ne confirme rien.</p> : null}
      {params.erreur === "deja" ? <p role="alert">Ce rendez-vous est déjà confirmé.</p> : null}
      {params.erreur === "absent" ? <p role="alert">Aucune demande de rendez-vous à confirmer.</p> : null}
      <p>{count === 0 ? "Aucune demande enregistrée." : `${count} demande${count > 1 ? "s" : ""}.`}</p>
      <ul className="plain-list">
        {full
          ? full.map((row) => (
              <li key={row.id}>
                <p>
                  {row.createdAt} — {funnelLabel(row.funnelName)} — {deliveryLabel(row.deliveryStatus)} — {row.name} — {row.email} — rendez-vous {appointmentLabel(row.appointmentStatus)}
                </p>
                {row.appointmentWindow ? <p>Plage demandée : {row.appointmentWindow}</p> : null}
                {row.confirmedSlot ? <p>Créneau confirmé : {row.confirmedSlot}</p> : null}
                {canConfirm && row.appointmentStatus === "requested" ? (
                  <form className="form-grid" action={confirmAppointmentAction}>
                    <input type="hidden" name="lead_id" value={row.id} />
                    <label>
                      Créneau réel
                      <input name="slot" required autoComplete="off" />
                    </label>
                    <button type="submit">Confirmer ce créneau</button>
                  </form>
                ) : null}
              </li>
            ))
          : aggregate!.map((row) => (
              <li key={row.id}>
                {row.createdAt} — {funnelLabel(row.funnelName)} — {deliveryLabel(row.deliveryStatus)} — rendez-vous {appointmentLabel(row.appointmentStatus)}
              </li>
            ))}
      </ul>
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
