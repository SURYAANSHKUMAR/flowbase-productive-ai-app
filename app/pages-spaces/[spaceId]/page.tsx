import { notFound } from "next/navigation";

import { SpaceWorkspace, type PageView, type SpaceView } from "@/app/pages-spaces/workspace";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { requireCurrentDbUser } from "@/lib/current-user";
import { getSpacePagesForUser, listSpacesWithPageCounts } from "@/lib/workspace-data";

type PageProps = {
  params: Promise<{ spaceId: string }>;
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

function pageView(page: Awaited<ReturnType<typeof getSpacePagesForUser>>["pages"][number]): PageView {
  return {
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
  };
}

export default async function SpacePage({ params }: PageProps) {
  const { spaceId: rawSpaceId } = await params;
  const spaceId = Number(rawSpaceId);
  if (!Number.isInteger(spaceId)) notFound();

  const user = await requireCurrentDbUser();
  const [spaceData, allSpaces] = await Promise.all([
    getSpacePagesForUser(user.id, spaceId).catch(() => null),
    listSpacesWithPageCounts(user.id),
  ]);
  if (!spaceData) notFound();

  const selectedSpace = allSpaces.find((space) => space.id === spaceData.space.id);
  const space = selectedSpace ? toSpaceView(selectedSpace) : { ...toSpaceView({ ...spaceData.space, pageCount: spaceData.pages.length }), pageCount: spaceData.pages.length };

  return (
    <ProtectedAppShell>
      <SpaceWorkspace pages={spaceData.pages.map(pageView)} space={space} spaces={allSpaces.map(toSpaceView)} />
    </ProtectedAppShell>
  );
}
