/** Chemins sous /admin qui restent accessibles sans session. */
export function adminPathRequiresSession(pathname: string): boolean {
  return pathname !== "/admin/login" && pathname !== "/admin/logout";
}
