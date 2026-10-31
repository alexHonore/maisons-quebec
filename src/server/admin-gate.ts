/** Seuls les chemins /admin exigent une session. La connexion et la sortie restent ouvertes. */
export function adminPathRequiresSession(pathname: string): boolean {
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return false;
  return pathname !== "/admin/login" && pathname !== "/admin/logout";
}
