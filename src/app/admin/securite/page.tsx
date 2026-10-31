import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { readLiveAdmin } from "@/server/current-admin";
import { settingsDatabase } from "@/server/public-site";
import { isPrivilegedAdminRole, renderTotpStatus, totpAccountState } from "@/server/totp-vault";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Second facteur",
  robots: { index: false, follow: false },
};

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ confirme?: string; erreur?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!isPrivilegedAdminRole(live.user.role)) forbidden();
  const params = await searchParams;
  const state = totpAccountState(settingsDatabase(process.env), live.user.id);
  const text = renderTotpStatus({
    state,
    sessionMfa: live.user.mfaSatisfied,
    globalSecretConfigured: Boolean(process.env.ADMIN_TOTP_SECRET?.trim()),
  });

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Second facteur</h1>
      <p>{text}</p>
      {params.confirme === "1" ? <p role="status">Second facteur confirmé. La prochaine connexion demandera le code.</p> : null}
      {params.erreur === "code" ? <p role="alert">Code refusé. Le secret n&apos;est pas réaffiché.</p> : null}
      {state !== "confirmed" ? (
        <form method="post" action="/admin/securite/enroll">
          <button className="button" type="submit">
            Préparer un second facteur
          </button>
        </form>
      ) : null}
      {state === "pending" ? (
        <form className="form-grid" method="post" action="/admin/securite/confirm">
          <label>
            Code de l&apos;application
            <input name="totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
          </label>
          <button type="submit">Confirmer</button>
        </form>
      ) : null}
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
