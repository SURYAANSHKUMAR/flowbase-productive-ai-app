"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isConfigError = error.message.includes("DATABASE_URL");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-lg rounded-lg border border-border bg-card p-6 text-center shadow-sm shadow-slate-900/[0.04]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-destructive">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-card-foreground">
          {isConfigError ? "Backend connection needs setup" : "This page could not load"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {isConfigError
            ? "Add a valid database connection string, then refresh the app."
            : "The app hit a temporary problem while loading this workspace page."}
        </p>
        <Button className="mt-5 rounded-lg gap-2" onClick={reset}>
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      </section>
    </main>
  );
}
