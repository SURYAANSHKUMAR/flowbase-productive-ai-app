import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { User } from "@/db/schema";
import { localSessionCookie } from "@/lib/app-mode";
import { getLocalUserById, upsertLocalUser } from "@/lib/local-store";

export async function getLocalSessionUser() {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get(localSessionCookie)?.value);

  if (!userId) {
    return null;
  }

  return getLocalUserById(userId);
}

export async function requireLocalSessionUser(): Promise<User> {
  const user = await getLocalSessionUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}

export async function createLocalSession(email: string, name?: string | null) {
  const user = await upsertLocalUser(email, name || email);
  const cookieStore = await cookies();

  cookieStore.set(localSessionCookie, String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return user;
}
