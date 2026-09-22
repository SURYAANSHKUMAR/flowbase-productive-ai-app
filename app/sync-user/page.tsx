import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { isLocalMode } from "@/lib/app-mode";
import { upsertCloudUser } from "@/lib/workspace-data";

export default async function SyncUserPage() {
  if (isLocalMode()) {
    redirect("/");
  }

  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const email = user.primaryEmailAddress?.emailAddress;

  if (!email) {
    redirect("/");
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const name = user.fullName || fullName || user.username || email;

  await upsertCloudUser(email, name);

  redirect("/");
}
