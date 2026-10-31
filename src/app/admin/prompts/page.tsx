import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { generateEditorialAction, savePromptLayerAction } from "@/app/admin/prompts/actions";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { L0_VERSION, readL0Prompt } from "@/server/editorial-l0";
import { currentPromptLayer, listPromptLayers } from "@/server/prompt-layers";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prompt L0",
  robots: { index: false, follow: false },
};

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ generation?: string; enregistre?: string; erreur?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "prompts.read")) forbidden();
  const params = await searchParams;
  const prompt = readL0Prompt();
  const db = settingsDatabase(process.env);
  const l1 = listPromptLayers(db, "L1");
  const l2 = listPromptLayers(db, "L2");
  const canWrite = roleCan(live.user.role, "prompts.write");

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
      {params.enregistre === "1" ? <p role="status">Version enregistrée. Le fichier L0 n&apos;a pas été modifié.</p> : null}
      {params.erreur ? <p role="alert">Enregistrement refusé.</p> : null}
      <h2>L1 — identité</h2>
      <p>{l1.length === 0 ? "Aucune version." : `Version courante ${currentPromptLayer(db, "L1")?.versionNumber}. ${l1.length} version${l1.length > 1 ? "s" : ""} conservée${l1.length > 1 ? "s" : ""}.`}</p>
      {canWrite ? (
        <form className="form-grid" action={savePromptLayerAction}>
          <input type="hidden" name="layer" value="L1" />
          <label>
            Texte L1
            <textarea name="body" rows={6} defaultValue={currentPromptLayer(db, "L1")?.body ?? ""} />
          </label>
          <button type="submit">Enregistrer une nouvelle version L1</button>
        </form>
      ) : null}
      <h2>L2 — tâche</h2>
      <p>{l2.length === 0 ? "Aucune version." : `Version courante ${currentPromptLayer(db, "L2")?.versionNumber}. ${l2.length} version${l2.length > 1 ? "s" : ""} conservée${l2.length > 1 ? "s" : ""}.`}</p>
      {canWrite ? (
        <form className="form-grid" action={savePromptLayerAction}>
          <input type="hidden" name="layer" value="L2" />
          <label>
            Texte L2
            <textarea name="body" rows={6} defaultValue={currentPromptLayer(db, "L2")?.body ?? ""} />
          </label>
          <button type="submit">Enregistrer une nouvelle version L2</button>
        </form>
      ) : null}
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
