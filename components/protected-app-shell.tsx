import * as React from "react";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { requireCurrentDbUser } from "@/lib/current-user";
import type { SidebarGeneratedApp } from "@/lib/ai-template-types";
import { ensureUserDefaults, getDashboardSummary, listSidebarAiGeneratedApps } from "@/lib/workspace-data";

export async function ProtectedAppShell({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentDbUser();
  await ensureUserDefaults(user);
  const [sidebarApps, dashboardSummary] = await Promise.all([listSidebarAiGeneratedApps(user.id), getDashboardSummary(user)]);
  const generatedApps: SidebarGeneratedApp[] = sidebarApps.map((app) => {
    const appJson = app.appJson as Partial<SidebarGeneratedApp>;
    return {
      id: app.id,
      appName: appJson.appName || "Generated app",
      description: appJson.description || "",
      icon: appJson.icon || "Sparkles",
      color: appJson.color || "#14B8A6",
    };
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(174_88%_91%),transparent_28%),radial-gradient(circle_at_18%_18%,hsl(198_100%_94%),transparent_25%),linear-gradient(180deg,hsl(188_80%_98%),hsl(188_72%_97%))]">
        <DashboardSidebar generatedApps={generatedApps} workspaceHealth={{ boards: dashboardSummary.counts.kanbanBoards, pages: dashboardSummary.counts.pages }} />
        {children}
      </div>
    </main>
  );
}
