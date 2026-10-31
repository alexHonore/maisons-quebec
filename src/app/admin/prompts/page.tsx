import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { generateEditorialAction } from "@/app/admin/prompts/actions";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { L0_VERSION, readL0Prompt } from "@/server/editorial-l0";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prompt L0",
  robots: { index: false, follow: false },
};

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ generation?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "prompts.read")) forbidden();
  const params = await searchParams;
  const prompt = readL0Prompt();

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Prompt L0</h1>
      <p>Lecture seule. Ce texte n&apos;est pas modifiable dans l&apos;administration.</p>
      <p>Version {L0_VERSION}</p>
      <p>Hash {prompt.sha256}</p>
      {params.generation === "a-connecter" ? (
        <p role="status">À connecter. Aucun article n&apos;a été écrit.</p>
      ) : null}
      {params.generation === "non-branchee" ? (
        <p role="status">La génération n&apos;est pas branchée. Aucun article n&apos;a été écrit.</p>
      ) : null}
      <form action={generateEditorialAction}>
        <button className="button" type="submit">
          Générer
        </button>
      </form>
      <pre>{prompt.text}</pre>
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
