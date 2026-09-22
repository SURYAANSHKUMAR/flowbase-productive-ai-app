import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

import { isLocalMode } from "@/lib/app-mode";
import { createLocalSession } from "@/lib/local-auth";

async function localSignUp(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/sign-up?error=Enter%20a%20valid%20email%20address");
  }

  await createLocalSession(email, name || email);
  redirect("/");
}

export default async function SignUpPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  if (isLocalMode()) {
    const params = await searchParams;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <form action={localSignUp} className="w-full max-w-sm rounded-lg border border-white/10 bg-white p-6 text-slate-950 shadow-2xl">
          <h1 className="text-2xl font-semibold">Create Flowbase account</h1>
          <p className="mt-2 text-sm text-slate-600">This creates a local workspace account for development and demos.</p>
          <label className="mt-5 block">
            <span className="text-sm font-semibold">Name</span>
            <input className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600" name="name" placeholder="Your name" />
          </label>
          <label className="mt-3 block">
            <span className="text-sm font-semibold">Email</span>
            <input className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-600" name="email" placeholder="you@example.com" type="email" />
          </label>
          {params?.error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{params.error}</p>}
          <button className="mt-5 h-11 w-full rounded-lg bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700" type="submit">
            Create account
          </button>
          <Link className="mt-4 block text-center text-sm font-semibold text-teal-700" href="/sign-in">
            Sign in instead
          </Link>
        </form>
      </main>
    );
  }

  return (
    <main style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b' }}>
      <SignUp forceRedirectUrl="/sync-user" />
    </main>
  );
}
