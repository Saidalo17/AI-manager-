import "server-only";
import { cookies, headers } from "next/headers";
import { createHash, randomUUID } from "node:crypto";

// Анонимная «учётная запись»: у каждого браузера свой случайный идентификатор в httpOnly-cookie.
// В базе хранится только его SHA-256 хэш, поэтому утечка базы не даёт доступа к чужим спискам.
const COOKIE = "taskly_id";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function getOwner(): Promise<string> {
  const jar = await cookies();
  let id = jar.get(COOKIE)?.value;
  if (!id || !UUID.test(id)) {
    id = randomUUID();
    const proto = (await headers()).get("x-forwarded-proto");
    jar.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: proto === "https",
      maxAge: 60 * 60 * 24 * 730,
      path: "/",
    });
  }
  return createHash("sha256").update(id).digest("hex");
}
