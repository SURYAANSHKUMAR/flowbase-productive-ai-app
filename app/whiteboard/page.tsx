import { WhiteboardWorkspace, type WhiteboardView } from "@/app/whiteboard/workspace";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { requireCurrentDbUser } from "@/lib/current-user";
import { listWhiteboards } from "@/lib/workspace-data";

export default async function WhiteboardPage() {
  const user = await requireCurrentDbUser();
  const whiteboardRows = await listWhiteboards(user.id);

  const whiteboards: WhiteboardView[] = whiteboardRows.map((whiteboard) => ({
    id: whiteboard.id,
    name: whiteboard.name,
    color: whiteboard.color,
    elements: whiteboard.elements,
    appState: whiteboard.appState,
    files: whiteboard.files,
    createdAt: whiteboard.createdAt.toISOString(),
    updatedAt: whiteboard.updatedAt.toISOString(),
  }));

  return (
    <ProtectedAppShell>
      <WhiteboardWorkspace whiteboards={whiteboards} />
    </ProtectedAppShell>
  );
}
