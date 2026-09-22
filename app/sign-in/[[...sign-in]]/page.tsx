import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

import { isLocalMode } from "@/lib/app-mode";
import { createLocalSession } from "@/lib/local-auth";

async function localSignIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/sign-in?error=Enter%20a%20valid%20email%20address");
  }

  await createLocalSession(email, email);
  redirect("/");
}

export default async function SignInPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  if (isLocalMode()) {
    const params = await searchParams;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <form action={localSignIn} className="w-full max-w-sm rounded-lg border border-white/10 bg-white p-6 text-slate-950 shadow-2xl">
          <h1 className="text-2xl font-semibold">Sign in to Flowbase</h1>
          <p className="mt-2 text-sm text-slate-600">Local mode uses your email to open a private workspace on this machine.</p>
          <label className="mt-5 block">
            <span className="text-sm font-semibold">Email</span>
            <input className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600" name="email" placeholder="you@example.com" type="email" />
          </label>
          {params?.error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{params.error}</p>}
          <button className="mt-5 h-11 w-full rounded-lg bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700" type="submit">
            Sign in
          </button>
          <Link className="mt-4 block text-center text-sm font-semibold text-teal-700" href="/sign-up">
            Create local account
          </Link>
        </form>
      </main>
    );
  }

  return (
    <main style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b' }}>
      <SignIn forceRedirectUrl="/sync-user" signUpForceRedirectUrl="/sync-user" />
    </main>
  );
}
