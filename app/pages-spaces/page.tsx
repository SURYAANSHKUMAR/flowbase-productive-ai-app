import { AllSpacesWorkspace, type SpaceView } from "@/app/pages-spaces/workspace";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { requireCurrentDbUser } from "@/lib/current-user";
import { listSpacesWithPageCounts } from "@/lib/workspace-data";

function spaceView(space: Awaited<ReturnType<typeof listSpacesWithPageCounts>>[number]): SpaceView {
  return {
    id: space.id,
    name: space.name,
    description: space.description,
    color: space.color,
    isFavorite: space.isFavorite,
    isArchived: space.isArchived,
    members: space.members,
    pageCount: space.pageCount,
    lastOpenedAt: space.lastOpenedAt?.toISOString() ?? null,
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt.toISOString(),
  };
}

export default async function PagesSpacesPage() {
  const user = await requireCurrentDbUser();
  const spaces = await listSpacesWithPageCounts(user.id);

  return (
    <ProtectedAppShell>
      <AllSpacesWorkspace spaces={spaces.map(spaceView)} />
    </ProtectedAppShell>
  );
}
