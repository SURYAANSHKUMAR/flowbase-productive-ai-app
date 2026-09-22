import { currentUser } from "@clerk/nextjs/server";
import { Liveblocks } from "@liveblocks/node";
import { and, eq } from "drizzle-orm";

import { isLiveblocksEnabled } from "@/lib/app-mode";
import { configuredValue } from "@/lib/env";

const avatarColors = ["#0f766e", "#0284c7", "#be123c", "#b45309", "#059669", "#7c3aed", "#475569"];

function colorForUser(value: string) {
  const total = value.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return avatarColors[total % avatarColors.length];
}

function boardIdFromRoom(room: string) {
  const match = /^kanban-board:(\d+)$/.exec(room);
  return match ? Number(match[1]) : null;
}

export async function POST(request: Request) {
  if (!isLiveblocksEnabled()) {
    return new Response("LIVEBLOCKS_SECRET_KEY is not configured.", { status: 500 });
  }
  const secret = configuredValue("LIVEBLOCKS_SECRET_KEY");

  const clerkUser = await currentUser();

  if (!clerkUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress;

  if (!email) {
    return new Response("Missing user email.", { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { room?: string; roomId?: string } | null;
  const room = body?.room ?? body?.roomId;
  const boardId = room ? boardIdFromRoom(room) : null;

  if (!room || !boardId) {
    return new Response("Invalid Liveblocks room.", { status: 400 });
  }

  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");
  const name = clerkUser.fullName || fullName || clerkUser.username || email;
  const { db, kanbanBoardShares, kanbanBoards, users } = await import("@/db");

  await db
    .insert(users)
    .values({ email, name })
    .onConflictDoUpdate({
      target: users.email,
      set: { name },
    });

  const [dbUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!dbUser) {
    return new Response("User not found.", { status: 401 });
  }

  const [board] = await db.select().from(kanbanBoards).where(eq(kanbanBoards.id, boardId)).limit(1);

  if (!board) {
    return new Response("Room not found.", { status: 404 });
  }

  if (board.userId !== dbUser.id) {
    const [share] = await db
      .select({ id: kanbanBoardShares.id })
      .from(kanbanBoardShares)
      .where(and(eq(kanbanBoardShares.boardId, boardId), eq(kanbanBoardShares.userId, dbUser.id)))
      .limit(1);

    if (!share) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const liveblocks = new Liveblocks({ secret });
  const session = liveblocks.prepareSession(String(dbUser.id), {
    userInfo: {
      name: dbUser.name || email,
      email,
      avatarUrl: clerkUser.imageUrl,
      color: colorForUser(email),
    },
  });

  session.allow(room, session.FULL_ACCESS);

  const { body: responseBody, status } = await session.authorize();
  return new Response(responseBody, { status });
}
