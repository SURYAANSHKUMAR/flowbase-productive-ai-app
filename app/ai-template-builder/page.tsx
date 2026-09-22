import { AiTemplateBuilderWorkspace } from "@/app/ai-template-builder/workspace";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { requireCurrentDbUser } from "@/lib/current-user";
import type { AiGeneratedAppView, AiTemplateAppJson } from "@/lib/ai-template-types";
import { listAiGeneratedApps } from "@/lib/workspace-data";

function toAppView(app: Awaited<ReturnType<typeof listAiGeneratedApps>>[number]): AiGeneratedAppView {
  return {
    id: app.id,
    appJson: app.appJson as AiTemplateAppJson,
    isInSidebar: app.isInSidebar,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
}

export default async function AiTemplateBuilderPage() {
  const user = await requireCurrentDbUser();
  const apps = await listAiGeneratedApps(user.id);

  return (
    <ProtectedAppShell>
      <AiTemplateBuilderWorkspace apps={apps.map(toAppView)} />
    </ProtectedAppShell>
  );
}
