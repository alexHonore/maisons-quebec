import Link from "next/link";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell">
      <header className="admin-bar">
        <div className="wrap admin-bar-row">
          <Link className="brand" href="/admin">
            <span>
              <span className="brand-name">Maisons Québec</span>
              <span className="brand-note">Administration</span>
            </span>
          </Link>
          <Link href="/">Voir le site</Link>
        </div>
      </header>
      {children}
    </div>
  );
}
