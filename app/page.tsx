import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Columns3,
  FileText,
  Layers3,
  PenTool,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { ProtectedAppShell } from "@/components/protected-app-shell";
import { requireCurrentDbUser } from "@/lib/current-user";
import { getDashboardSummary, type DashboardSummary } from "@/lib/workspace-data";

function formatTime(value: Date | null) {
  if (!value) return "Never opened";
  const diff = Date.now() - value.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < day * 2) return "yesterday";
  if (diff < day * 7) return `${Math.floor(diff / day)} days ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(value);
}

function statCards(summary: DashboardSummary) {
  return [
    { label: "Tasks tracked", value: String(summary.counts.kanbanTasks), icon: CheckCircle2, color: "text-emerald-500", href: "/kanban" },
    { label: "Calendar items", value: String(summary.counts.calendarItems), icon: Clock3, color: "text-sky-500", href: "/calendar" },
    { label: "AI apps", value: String(summary.counts.aiGeneratedApps), icon: Sparkles, color: "text-violet-500", href: "/ai-template-builder" },
  ];
}

export default async function Home() {
  const user = await requireCurrentDbUser();
  const summary = await getDashboardSummary(user);
  const displayName = user.name?.split(" ")[0] || user.email.split("@")[0];

  return (
    <ProtectedAppShell>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/75 bg-background/70 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Welcome back, {displayName}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">Build your workspace flow</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/75 bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent" href="/ai-assistant">
              <Sparkles className="h-4 w-4 text-teal-500" aria-hidden="true" />
              Start prompt
            </Link>
            <Link className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm shadow-teal-900/10 transition-colors hover:bg-primary/90" href="/pages-spaces">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New page
            </Link>
          </div>
        </header>

        <div className="grid gap-5 px-6 py-6 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="space-y-5">
            <div className="rounded-lg border border-border/75 bg-card/95 p-5 shadow-sm shadow-slate-900/[0.025]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Today</p>
                  <h2 className="mt-1 text-xl font-semibold text-card-foreground">
                    {summary.todayItems.length ? `${summary.todayItems.length} scheduled ${summary.todayItems.length === 1 ? "item" : "items"}` : "No scheduled items yet"}
                  </h2>
                </div>
                <Link className="rounded-lg border border-teal-100 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100" href="/calendar">
                  Open calendar
                </Link>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {statCards(summary).map((stat) => (
                  <Link key={stat.label} className="rounded-lg border border-border/75 bg-background/80 p-4 transition hover:-translate-y-0.5 hover:shadow-sm" href={stat.href}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} aria-hidden="true" />
                    <p className="mt-3 text-2xl font-semibold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <DashboardPanel
                icon={<FileText className="h-5 w-5 text-amber-500" />}
                label="Notes"
                title={summary.recentNotes[0]?.title ?? "Create your first note"}
                description={
                  summary.recentNotes[0]
                    ? `Updated ${formatTime(summary.recentNotes[0].updatedAt)} with ${summary.recentNotes[0].wordCount} words.`
                    : "Capture research, meeting notes, and polished drafts in one writing space."
                }
                href="/notes"
              />
              <DashboardPanel
                icon={<PenTool className="h-5 w-5 text-violet-500" />}
                label="Whiteboard"
                title={summary.recentWhiteboards[0]?.name ?? "Map an idea"}
                description={
                  summary.recentWhiteboards[0]
                    ? `Updated ${formatTime(summary.recentWhiteboards[0].updatedAt)}.`
                    : "Sketch flows, cluster decisions, and turn loose ideas into connected systems."
                }
                href="/whiteboard"
              />
            </div>

            <div className="rounded-lg border border-border/75 bg-card/95 p-5 shadow-sm shadow-slate-900/[0.025]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-card-foreground">Workspace health</h2>
                <Link className="text-sm font-semibold text-teal-700 hover:text-teal-800" href="/settings">
                  Settings
                </Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <HealthTile icon={Columns3} label="Boards" value={summary.counts.kanbanBoards} />
                <HealthTile icon={Layers3} label="Spaces" value={summary.counts.spaces} />
                <HealthTile icon={FileText} label="Pages" value={summary.counts.pages} />
                <HealthTile icon={CalendarDays} label="Today" value={summary.todayItems.length} />
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-lg border border-border/75 bg-card/95 p-5 shadow-sm shadow-slate-900/[0.025]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-card-foreground">Spaces</h2>
                <Link href="/pages-spaces" title="Open spaces">
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {summary.recentSpaces.length ? (
                  summary.recentSpaces.map((space) => (
                    <Link key={space.id} className="flex items-center gap-3 rounded-lg border border-border/75 bg-background/80 p-3 transition hover:bg-accent" href={`/pages-spaces/${space.id}`}>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Layers3 className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{space.name}</p>
                        <p className="text-xs text-muted-foreground">{space.pageCount} {space.pageCount === 1 ? "page" : "pages"} · updated {formatTime(space.updatedAt)}</p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border/75 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
                    Create a space to organize pages, plans, and docs.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border/75 bg-card/95 p-5 shadow-sm shadow-slate-900/[0.025]">
              <h2 className="text-base font-semibold text-card-foreground">AI Assistant</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Turn notes into tasks, summarize boards, and generate reusable workspace apps.
              </p>
              <Link className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border/75 bg-background/85 text-sm font-semibold text-foreground transition-colors hover:bg-accent" href="/ai-assistant">
                <Sparkles className="h-4 w-4 text-teal-500" aria-hidden="true" />
                Start prompt
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </ProtectedAppShell>
  );
}

function DashboardPanel({
  icon,
  label,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link className="rounded-lg border border-border/75 bg-card/95 p-5 shadow-sm shadow-slate-900/[0.025] transition hover:-translate-y-0.5 hover:shadow-md" href={href}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      </div>
      <h3 className="mt-4 text-base font-semibold text-card-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  );
}

function HealthTile({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/75 bg-background/80 p-3">
      <Icon className="h-4 w-4 text-teal-600" aria-hidden />
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
