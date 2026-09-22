export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-sm shadow-slate-900/[0.04]">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-8 w-full animate-pulse rounded bg-muted" />
        <div className="mt-3 h-8 w-4/5 animate-pulse rounded bg-muted" />
      </div>
    </main>
  );
}
