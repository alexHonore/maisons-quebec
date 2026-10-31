import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Accès refusé</h1>
      <p>Ce rôle n&apos;a pas le droit d&apos;ouvrir cette page. Aucune modification n&apos;a été enregistrée.</p>
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
