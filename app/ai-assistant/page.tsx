import { AiAssistantWorkspace } from "@/app/ai-assistant/workspace";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { requireCurrentDbUser } from "@/lib/current-user";

export default async function AiAssistantPage() {
  await requireCurrentDbUser();

  return (
    <ProtectedAppShell>
      <AiAssistantWorkspace />
    </ProtectedAppShell>
  );
}
