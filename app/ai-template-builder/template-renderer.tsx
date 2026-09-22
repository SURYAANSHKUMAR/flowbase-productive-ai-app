"use client";

import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Dumbbell,
  Flame,
  GraduationCap,
  HeartPulse,
  LayoutTemplate,
  ListChecks,
  NotebookTabs,
  Sparkles,
  Utensils,
} from "lucide-react";
import * as React from "react";

import type { AiTemplateAppJson, AiTemplateComponent } from "@/lib/ai-template-types";
import { cn } from "@/lib/utils";

const iconMap = {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Dumbbell,
  Flame,
  GraduationCap,
  HeartPulse,
  LayoutTemplate,
  ListChecks,
  NotebookTabs,
  Sparkles,
  Utensils,
};

function iconFor(name: string) {
  return iconMap[name as keyof typeof iconMap] ?? Sparkles;
}

function valueText(value: unknown) {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  return "";
}

function componentItems(component: AiTemplateComponent, sampleData: Record<string, unknown>[]) {
  return component.items?.length ? component.items : sampleData;
}

export function TemplateIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = iconFor(icon);
  return <Icon className={className} aria-hidden="true" />;
}

export function TemplateRenderer({ app, compact = false }: { app: AiTemplateAppJson; compact?: boolean }) {
  const Icon = iconFor(app.icon);
  const sections = app.sections.length
    ? app.sections
    : [{ title: "Overview", description: app.description, components: app.components }];

  return (
    <div className={cn("min-w-0 rounded-lg border border-border/75 bg-card/95 shadow-sm shadow-slate-900/[0.025]", compact ? "p-4" : "p-5 sm:p-6")}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/75 pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white shadow-sm" style={{ backgroundColor: app.color }}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className={cn("truncate font-semibold text-card-foreground", compact ? "text-lg" : "text-2xl")}>{app.appName}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{app.description}</p>
          </div>
        </div>
        <span className="rounded-lg border border-border/75 bg-background px-2.5 py-1 text-xs font-bold text-muted-foreground">Single page</span>
      </header>

      <div className={cn("space-y-5", compact ? "mt-4" : "mt-6")}>
        {sections.map((section, sectionIndex) => (
          <section key={`${section.title}-${sectionIndex}`} className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">{section.title}</h3>
              {section.description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{section.description}</p>}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {section.components.map((component, componentIndex) => (
                <TemplateBlock key={`${component.title}-${componentIndex}`} app={app} component={component} compact={compact} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function TemplateBlock({ app, compact, component }: { app: AiTemplateAppJson; compact: boolean; component: AiTemplateComponent }) {
  const items = componentItems(component, app.sampleData);

  if (component.type === "stats") {
    const stats = items.length ? items : [{ label: "Progress", value: "72%" }, { label: "Active", value: "8" }, { label: "Done", value: "14" }];
    return (
      <BlockFrame component={component}>
        <div className="grid gap-2 sm:grid-cols-3">
          {stats.slice(0, 3).map((item, index) => {
            const values = Object.values(item);
            return (
              <div key={index} className="rounded-lg border border-border/75 bg-background/85 p-3">
                <p className="text-xl font-semibold text-foreground">{valueText(values[1] ?? values[0] ?? index + 1)}</p>
                <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{valueText(values[0] ?? "Metric")}</p>
              </div>
            );
          })}
        </div>
      </BlockFrame>
    );
  }

  if (component.type === "table") {
    const rows = items.length ? items : [{ Item: "Sample row", Status: "Ready", Owner: "You" }];
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, compact ? 3 : 5);
    return (
      <BlockFrame component={component}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/75 text-xs uppercase text-muted-foreground">
                {columns.map((column) => (
                  <th key={column} className="px-2 py-2 font-bold">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, index) => (
                <tr key={index} className="border-b border-border/60 last:border-0">
                  {columns.map((column) => (
                    <td key={column} className="px-2 py-2 font-medium text-foreground">{valueText(row[column]) || "-"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BlockFrame>
    );
  }

  if (component.type === "form") {
    const fields = component.fields?.length ? component.fields : app.fields;
    return (
      <BlockFrame component={component}>
        <div className="space-y-3">
          {(fields.length ? fields : [{ label: "New item", type: "text" as const, placeholder: "Add a detail" }]).slice(0, compact ? 3 : 6).map((field) => (
            <label key={field.label} className="block">
              <span className="text-xs font-bold text-muted-foreground">{field.label}</span>
              {field.type === "textarea" ? (
                <textarea className="mt-1 min-h-20 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none" placeholder={field.placeholder} />
              ) : field.type === "select" ? (
                <select className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none">
                  {(field.options?.length ? field.options : ["Option"]).map((option) => <option key={option}>{option}</option>)}
                </select>
              ) : (
                <input className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none" type={field.type === "checkbox" ? "checkbox" : field.type} placeholder={field.placeholder} />
              )}
            </label>
          ))}
        </div>
      </BlockFrame>
    );
  }

  if (component.type === "progress") {
    const rows = items.length ? items : [{ label: "Weekly progress", value: 68 }, { label: "Focus target", value: 42 }];
    return (
      <BlockFrame component={component}>
        <div className="space-y-3">
          {rows.slice(0, 4).map((item, index) => {
            const values = Object.values(item);
            const amount = Math.max(10, Math.min(100, Number(values.find((value) => typeof value === "number")) || 58));
            return (
              <div key={index}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-semibold text-foreground">{valueText(values[0]) || "Progress"}</span>
                  <span className="font-bold text-muted-foreground">{amount}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${amount}%`, backgroundColor: app.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </BlockFrame>
    );
  }

  if (component.type === "checklist") {
    const rows = items.length ? items : [{ task: "Review plan" }, { task: "Add first item" }, { task: "Check progress" }];
    return (
      <BlockFrame component={component}>
        <div className="space-y-2">
          {rows.slice(0, 6).map((item, index) => (
            <label key={index} className="flex items-center gap-2 rounded-lg border border-border/75 bg-background/80 px-3 py-2 text-sm font-semibold text-foreground">
              <input type="checkbox" defaultChecked={index === 0} />
              <span className="min-w-0 flex-1 truncate">{valueText(Object.values(item)[0]) || "Checklist item"}</span>
            </label>
          ))}
        </div>
      </BlockFrame>
    );
  }

  if (component.type === "buttons") {
    const actions = component.actions?.length ? component.actions : app.actions;
    return (
      <BlockFrame component={component}>
        <div className="flex flex-wrap gap-2">
          {(actions.length ? actions : [{ label: "Add item", style: "primary" as const }]).slice(0, 5).map((action) => (
            <button
              key={action.label}
              className={cn(
                "h-9 rounded-lg px-3 text-sm font-semibold transition-colors",
                action.style === "primary" && "text-white",
                action.style === "secondary" && "bg-secondary text-secondary-foreground",
                (!action.style || action.style === "outline") && "border border-border/75 bg-background text-foreground hover:bg-accent"
              )}
              style={action.style === "primary" ? { backgroundColor: app.color } : undefined}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      </BlockFrame>
    );
  }

  if (component.type === "tags") {
    const tags = items.length ? items : [{ tag: "Today" }, { tag: "Focus" }, { tag: "Draft" }];
    return (
      <BlockFrame component={component}>
        <div className="flex flex-wrap gap-2">
          {tags.slice(0, 10).map((item, index) => (
            <span key={index} className="rounded-lg border border-border/75 bg-background px-2.5 py-1 text-xs font-bold text-muted-foreground">
              {valueText(Object.values(item)[0]) || "Tag"}
            </span>
          ))}
        </div>
      </BlockFrame>
    );
  }

  if (component.type === "chart-placeholder") {
    return (
      <BlockFrame component={component}>
        <div className="flex h-40 items-end gap-2 rounded-lg border border-dashed border-border bg-background/80 p-4">
          {[38, 62, 48, 80, 54, 72].map((height, index) => (
            <div key={index} className="flex-1 rounded-t-md" style={{ height: `${height}%`, backgroundColor: app.color, opacity: 0.35 + index * 0.08 }} />
          ))}
        </div>
      </BlockFrame>
    );
  }

  return (
    <BlockFrame component={component}>
      <div className="space-y-2">
        {(items.length ? items : [{ item: "Sample item" }]).slice(0, 5).map((item, index) => (
          <div key={index} className="rounded-lg border border-border/75 bg-background/80 px-3 py-2 text-sm font-semibold text-foreground">
            {valueText(Object.values(item)[0]) || "Item"}
          </div>
        ))}
      </div>
    </BlockFrame>
  );
}

function BlockFrame({ children, component }: { children: React.ReactNode; component: AiTemplateComponent }) {
  return (
    <article className="min-w-0 rounded-lg border border-border/75 bg-background/65 p-4">
      <div className="mb-3">
        <h4 className="truncate text-sm font-semibold text-foreground">{component.title}</h4>
        {component.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{component.description}</p>}
      </div>
      {children}
    </article>
  );
}
