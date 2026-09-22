"use client"

import {
  Bot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Gauge,
  FileText,
  Flame,
  LayoutDashboard,
  LayoutTemplate,
  Layers3,
  LifeBuoy,
  PenTool,
  Settings,
  Sparkles,
  X,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"

import { removeGeneratedAppFromSidebar } from "@/app/ai-template-builder/actions"
import { Button } from "@/components/ui/button"
import type { SidebarGeneratedApp } from "@/lib/ai-template-types"
import { cn } from "@/lib/utils"

const navGroups = [
  {
    label: "Plan",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, color: "text-rose-500", bg: "bg-rose-50", href: "/" },
      { label: "AI Assistant", icon: Bot, color: "text-teal-600", bg: "bg-teal-50", href: "/ai-assistant" },
      { label: "Calendar", icon: CalendarDays, color: "text-sky-500", bg: "bg-sky-50", href: "/calendar" },
      { label: "Task / Kanban", icon: Columns3, color: "text-emerald-500", bg: "bg-emerald-50", href: "/kanban" },
    ],
  },
  {
    label: "Create & Map",
    items: [
      { label: "Notes", icon: FileText, color: "text-amber-500", bg: "bg-amber-50", href: "/notes" },
      { label: "Whiteboard", icon: PenTool, color: "text-violet-500", bg: "bg-violet-50", href: "/whiteboard" },
      { label: "Pages / Spaces", icon: Layers3, color: "text-indigo-500", bg: "bg-indigo-50", href: "/pages-spaces" },
      { label: "AI Template Builder", icon: LayoutTemplate, color: "text-fuchsia-500", bg: "bg-fuchsia-50", href: "/ai-template-builder" },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "Settings", icon: Settings, color: "text-slate-500", bg: "bg-slate-100", href: "/settings" },
    ],
  },
]

export function DashboardSidebar({
  generatedApps = [],
  workspaceHealth,
}: {
  generatedApps?: SidebarGeneratedApp[];
  workspaceHealth?: { boards: number; pages: number };
}) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [pendingRemovalId, setPendingRemovalId] = React.useState<number | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  async function removeSidebarApp(appId: number) {
    setPendingRemovalId(appId)
    try {
      await removeGeneratedAppFromSidebar(appId)
      router.refresh()
    } finally {
      setPendingRemovalId(null)
    }
  }

  return (
    <aside
      className={cn(
        "flex min-h-dvh shrink-0 flex-col border-r border-border/75 bg-sidebar/95 px-2 py-3 shadow-[1px_0_18px_rgba(15,23,42,0.035)] transition-all duration-300",
        collapsed ? "w-[60px]" : "w-[196px]"
      )}
    >
      <div className={cn("mb-3.5 flex items-center gap-2", collapsed && "flex-col gap-1.5")}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-teal-900/10">
          <Sparkles className="h-[15px] w-[15px]" aria-hidden="true" />
        </div>
        <div className={cn("min-w-0 transition-opacity", collapsed && "hidden")}>
          <p className="truncate text-[13px] font-semibold leading-tight text-foreground">Flowbase</p>
          <p className="truncate text-[10px] font-medium text-muted-foreground">Fresh workspace OS</p>
        </div>
        <Button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "ml-auto h-6 w-6 shrink-0 rounded-md border border-border/75 bg-background/90 text-muted-foreground shadow-none hover:bg-accent hover:text-foreground",
            collapsed && "ml-0"
          )}
          size="icon"
          type="button"
          variant="ghost"
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      </div>

      <nav className="flex flex-1 flex-col gap-2.5" aria-label="Main navigation">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p
              className={cn(
                "px-1.5 text-[8.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/75",
                collapsed && "hidden"
              )}
            >
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = item.href === "/" ? pathname === "/" : Boolean(item.href && pathname.startsWith(item.href))
                const itemClassName = cn(
                  "group flex h-7 w-full items-center gap-1.5 rounded-lg px-1.5 text-left text-[12px] font-medium text-sidebar-foreground transition-colors hover:bg-accent/80 hover:text-foreground",
                  isActive && "bg-primary-soft/90 text-foreground shadow-sm shadow-teal-900/5",
                  collapsed && "justify-center px-0"
                )
                const itemContent = (
                  <>
                    <span
                      className={cn(
                        "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md transition-colors",
                        item.bg,
                        collapsed && "h-7 w-7"
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", item.color)} aria-hidden="true" />
                    </span>
                    <span className={cn("truncate", collapsed && "hidden")}>{item.label}</span>
                  </>
                )

                return item.href ? (
                  <Link
                    key={item.label}
                    className={itemClassName}
                    aria-current={isActive ? "page" : undefined}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                  >
                    {itemContent}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    className={cn(itemClassName, "cursor-not-allowed opacity-55 hover:bg-transparent hover:text-sidebar-foreground")}
                    aria-disabled="true"
                    title={collapsed ? item.label : undefined}
                    disabled
                    type="button"
                  >
                    {itemContent}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {generatedApps.length > 0 && (
          <div className="space-y-1">
            <p
              className={cn(
                "px-1.5 text-[8.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/75",
                collapsed && "hidden"
              )}
            >
              My Apps
            </p>
            <div className="space-y-0.5">
              {generatedApps.map((app) => {
                const isActive = pathname.startsWith(`/ai-template-builder/${app.id}`)
                return (
                  <div
                    key={app.id}
                    className={cn(
                      "group flex h-7 w-full items-center gap-1.5 rounded-lg px-1.5 text-left text-[12px] font-medium text-sidebar-foreground transition-colors hover:bg-accent/80 hover:text-foreground",
                      isActive && "bg-primary-soft/90 text-foreground shadow-sm shadow-teal-900/5",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    <Link
                      className={cn("flex min-w-0 flex-1 items-center gap-1.5", collapsed && "justify-center")}
                      href={`/ai-template-builder/${app.id}`}
                      title={collapsed ? app.appName : undefined}
                    >
                      <span
                        className={cn(
                          "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-white transition-colors",
                          collapsed && "h-7 w-7"
                        )}
                        style={{ backgroundColor: app.color }}
                      >
                        <GeneratedSidebarIcon icon={app.icon} />
                      </span>
                      <span className={cn("truncate", collapsed && "hidden")}>{app.appName}</span>
                    </Link>
                    {!collapsed && (
                      <button
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-100 transition hover:bg-card hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
                        disabled={pendingRemovalId === app.id}
                        title="Remove from sidebar"
                        type="button"
                        onClick={() => removeSidebarApp(app.id)}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                        <span className="sr-only">Remove {app.appName} from sidebar</span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      <div className="mt-3 border-t border-border/75 pt-2.5">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border border-teal-100 bg-primary-soft/80 p-1.5",
            collapsed && "justify-center border-transparent bg-transparent p-0"
          )}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal-100 text-teal-700">
            {collapsed ? (
              <LifeBuoy className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Gauge className="h-3 w-3" aria-hidden="true" />
            )}
          </div>
          <div className={cn("min-w-0", collapsed && "hidden")}>
            <p className="truncate text-[12px] font-semibold text-foreground">Workspace health</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {workspaceHealth ? `${workspaceHealth.boards} boards · ${workspaceHealth.pages} pages` : "Workspace ready"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function GeneratedSidebarIcon({ icon }: { icon: string }) {
  const icons = { Sparkles, LayoutTemplate, Flame, CalendarDays, FileText, Columns3, Gauge, Layers3 }
  const Icon = icons[icon as keyof typeof icons] ?? Sparkles
  return <Icon className="h-3.5 w-3.5" aria-hidden="true" />
}
