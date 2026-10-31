import Link from "next/link";
import { ADMIN_REFUSAL_COPY } from "@/server/admin-access";

export default function Unauthorized() {
  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>{ADMIN_REFUSAL_COPY.title}</h1>
      <p>{ADMIN_REFUSAL_COPY.lead}</p>
      <p>{ADMIN_REFUSAL_COPY.mfa}</p>
      <p>{ADMIN_REFUSAL_COPY.scope}</p>
      <p>
        <Link href="/">{ADMIN_REFUSAL_COPY.back}</Link>
      </p>
    </main>
  );
}
