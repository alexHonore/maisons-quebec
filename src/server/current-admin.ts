import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, authorizeAdminRequest, type AccessDecision } from "./admin-access";

export async function readCurrentAdmin(): Promise<AccessDecision> {
  const jar = await cookies();
  return authorizeAdminRequest({
    secret: process.env.ADMIN_SESSION_SECRET,
    cookieValue: jar.get(ADMIN_COOKIE_NAME)?.value,
    now: new Date(),
  });
}
