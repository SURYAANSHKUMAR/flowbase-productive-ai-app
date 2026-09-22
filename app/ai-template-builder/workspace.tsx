"use client";

import { ArrowUpRight, LayoutTemplate, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  addGeneratedAppToSidebar,
  deleteGeneratedApp,
  generateTemplateApp,
  removeGeneratedAppFromSidebar,
} from "@/app/ai-template-builder/actions";
import { TemplateIcon, TemplateRenderer } from "@/app/ai-template-builder/template-renderer";
import { Button } from "@/components/ui/button";
import type { AiGeneratedAppView } from "@/lib/ai-template-types";
import { cn } from "@/lib/utils";

export function AiTemplateBuilderWorkspace({ apps }: { apps: AiGeneratedAppView[] }) {
  const router = useRouter();
  const [localApps, setLocalApps] = React.useState<AiGeneratedAppView[]>(apps);
  const [prompt, setPrompt] = React.useState("");
  const [selectedAppId, setSelectedAppId] = React.useState<number | null>(apps[0]?.id ?? null);
  const [error, setError] = React.useState("");
  const [isGenerating, startGenerating] = React.useTransition();
  const [isUpdating, startUpdating] = React.useTransition();

  React.useEffect(() => {
    setLocalApps(apps);
    setSelectedAppId((current) => (current && apps.some((app) => app.id === current) ? current : apps[0]?.id ?? null));
  }, [apps]);

  const selectedApp = localApps.find((app) => app.id === selectedAppId) ?? null;
  const sidebarCount = localApps.filter((app) => app.isInSidebar).length;

  function refresh() {
    router.refresh();
  }

  function generate() {
    setError("");
    startGenerating(async () => {
      try {
        const result = await generateTemplateApp(prompt);
        const now = new Date().toISOString();
        setLocalApps((current) => [
          {
            id: result.appId,
            appJson: result.appJson,
            isInSidebar: false,
            createdAt: now,
            updatedAt: now,
          },
          ...current,
        ]);
        setSelectedAppId(result.appId);
        setPrompt("");
        refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to generate template.");
      }
    });
  }

  function toggleSidebar(app: AiGeneratedAppView) {
    setError("");
    if (!app.isInSidebar && sidebarCount >= 3) {
      setError("You can add up to 3 generated apps to the sidebar.");
      return;
    }

    setLocalApps((current) => current.map((item) => (item.id === app.id ? { ...item, isInSidebar: !app.isInSidebar } : item)));
    startUpdating(async () => {
      try {
        if (app.isInSidebar) {
          await removeGeneratedAppFromSidebar(app.id);
        } else {
          await addGeneratedAppToSidebar(app.id);
        }
        refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to update sidebar.");
        setLocalApps((current) => current.map((item) => (item.id === app.id ? { ...item, isInSidebar: app.isInSidebar } : item)));
      }
    });
  }

  function deleteApp(app: AiGeneratedAppView) {
    setError("");
    setLocalApps((current) => current.filter((item) => item.id !== app.id));
    setSelectedAppId((current) => (current === app.id ? localApps.find((item) => item.id !== app.id)?.id ?? null : current));
    startUpdating(async () => {
      try {
        await deleteGeneratedApp(app.id);
        refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to delete app.");
        refresh();
      }
    });
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/75 bg-background/70 px-4 py-4 backdrop-blur sm:px-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">AI Template Builder</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">Generate mini apps from a prompt</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Describe a tracker, planner, dashboard, or workflow and Flowbase will save it as a private JSON-powered single-page app.
          </p>
        </div>
        <span className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700">
          {sidebarCount}/3 in sidebar
        </span>
      </header>

      <div className="grid gap-5 px-4 py-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(460px,1.1fr)] sm:px-6">
        <div className="space-y-5">
          <section className="rounded-lg border border-border/75 bg-card/95 p-5 shadow-sm shadow-slate-900/[0.025]">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fuchsia-50 text-fuchsia-600">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-card-foreground">Prompt</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Try “meal planner with grocery list and weekly nutrition progress”.</p>
              </div>
            </div>

            <textarea
              className="mt-4 min-h-32 w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm leading-6 outline-none transition focus:ring-2 focus:ring-teal-200"
              disabled={isGenerating}
              placeholder="Describe the single-page app you want..."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold text-muted-foreground">Output is saved privately to your account.</p>
              <Button className="h-9 rounded-lg gap-2" disabled={isGenerating || !prompt.trim()} onClick={generate}>
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                {isGenerating ? "Generating..." : "Generate"}
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border/75 bg-card/95 p-5 shadow-sm shadow-slate-900/[0.025]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-card-foreground">Created apps</h2>
                <p className="mt-1 text-sm text-muted-foreground">{localApps.length ? `${localApps.length} saved templates` : "No generated apps yet"}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {localApps.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background/75 p-5 text-sm leading-6 text-muted-foreground">
                  Generated apps will appear here with preview, sidebar, and delete controls.
                </div>
              ) : (
                localApps.map((app) => (
                  <GeneratedAppCard
                    key={app.id}
                    app={app}
                    active={app.id === selectedAppId}
                    disabled={isUpdating}
                    onDelete={deleteApp}
                    onSelect={setSelectedAppId}
                    onToggleSidebar={toggleSidebar}
                  />
                ))
              )}
            </div>
          </section>
        </div>

        <section className="min-w-0">
          {selectedApp ? (
            <TemplateRenderer app={selectedApp.appJson} />
          ) : (
            <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-dashed border-border bg-card/80 p-6 text-center">
              <div className="max-w-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-fuchsia-50 text-fuchsia-600">
                  <LayoutTemplate className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-foreground">No app preview yet</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Generate an app to preview the saved JSON layout here.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function GeneratedAppCard({
  active,
  app,
  disabled,
  onDelete,
  onSelect,
  onToggleSidebar,
}: {
  active: boolean;
  app: AiGeneratedAppView;
  disabled: boolean;
  onDelete: (app: AiGeneratedAppView) => void;
  onSelect: (appId: number) => void;
  onToggleSidebar: (app: AiGeneratedAppView) => void;
}) {
  const createdAt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(app.createdAt));

  return (
    <article
      className={cn(
        "rounded-lg border bg-background/80 p-3 transition-colors",
        active ? "border-primary/35 shadow-sm shadow-teal-900/5" : "border-border/75 hover:bg-accent/50"
      )}
    >
      <button className="flex w-full min-w-0 items-start gap-3 text-left" type="button" onClick={() => onSelect(app.id)}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: app.appJson.color }}>
          <TemplateIcon icon={app.appJson.icon} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{app.appJson.appName}</span>
          <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{app.appJson.description}</span>
          <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted-foreground">
            <span className="rounded-md border border-border/75 bg-card px-1.5 py-0.5">{app.appJson.color}</span>
            <span>{createdAt}</span>
          </span>
        </span>
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild className="h-8 rounded-lg px-2 text-xs" variant="outline">
          <Link href={`/ai-template-builder/${app.id}`}>
            <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Preview
          </Link>
        </Button>
        <Button className="h-8 rounded-lg px-2 text-xs" disabled={disabled} variant="outline" onClick={() => onToggleSidebar(app)}>
          {app.isInSidebar ? "Remove Sidebar" : "Add Sidebar"}
        </Button>
        <Button className="h-8 rounded-lg px-2 text-xs text-rose-600" disabled={disabled} variant="outline" onClick={() => onDelete(app)}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </Button>
      </div>
    </article>
  );
}
