import { notFound } from "next/navigation";

import { PageDetailWorkspace, type PageDetailView, type SpaceView } from "@/app/pages-spaces/workspace";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { requireCurrentDbUser } from "@/lib/current-user";
import { getPageDetailForUser, listSpacesWithPageCounts } from "@/lib/workspace-data";

type PageProps = {
  params: Promise<{ spaceId: string; pageId: string }>;
};

function toSpaceView(space: Awaited<ReturnType<typeof listSpacesWithPageCounts>>[number]): SpaceView {
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

export default async function WorkspacePageDetail({ params }: PageProps) {
  const { spaceId: rawSpaceId, pageId: rawPageId } = await params;
  const spaceId = Number(rawSpaceId);
  const pageId = Number(rawPageId);
  if (!Number.isInteger(spaceId) || !Number.isInteger(pageId)) notFound();

  const user = await requireCurrentDbUser();
  const [detail, allSpaces] = await Promise.all([
    getPageDetailForUser(user.id, spaceId, pageId).catch(() => null),
    listSpacesWithPageCounts(user.id),
  ]);
  if (!detail) notFound();

  const page = detail.page;
  const view: PageDetailView = {
    id: page.id,
    spaceId: page.spaceId,
    name: page.name,
    template: page.template,
    description: page.description,
    isFavorite: page.isFavorite,
    isArchived: page.isArchived,
    commentsCount: page.commentsCount,
    linkedTasksCount: page.linkedTasksCount,
    lastEditedBy: page.lastEditedBy,
    lastOpenedAt: page.lastOpenedAt?.toISOString() ?? null,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
    space: {
      id: page.space.id,
      name: page.space.name,
      description: page.space.description,
      color: page.space.color,
      isFavorite: page.space.isFavorite,
      isArchived: page.space.isArchived,
      members: page.space.members,
      lastOpenedAt: page.space.lastOpenedAt?.toISOString() ?? null,
      createdAt: page.space.createdAt.toISOString(),
      updatedAt: page.space.updatedAt.toISOString(),
    },
  };

  return (
    <ProtectedAppShell>
      <PageDetailWorkspace page={view} spaces={allSpaces.map(toSpaceView)} />
    </ProtectedAppShell>
  );
}
