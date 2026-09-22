import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";

import { isLocalMode } from "@/lib/app-mode";
import { requireLocalSessionUser } from "@/lib/local-auth";
import { upsertCloudUser } from "@/lib/workspace-data";

export const requireCurrentDbUser = cache(async () => {
  if (isLocalMode()) {
    return requireLocalSessionUser();
  }

  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect("/sign-in");
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress;

  if (!email) {
    redirect("/");
  }

  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");
  const name = clerkUser.fullName || fullName || clerkUser.username || email;

  const user = await upsertCloudUser(email, name);

  if (!user) {
    redirect("/");
  }

  return user;
});
