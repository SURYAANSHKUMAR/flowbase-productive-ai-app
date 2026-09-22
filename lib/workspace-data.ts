import "server-only";

import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";

import type { CalendarCategory, CalendarItemType } from "@/app/calendar/actions";
import type { KanbanLabel, KanbanPriority } from "@/app/kanban/actions";
import type { NoteColor, NoteContent } from "@/app/notes/actions";
import type { AiTemplateAppJson } from "@/lib/ai-template-types";
import { isLocalMode } from "@/lib/app-mode";
import { getLocalData, localIds, updateLocalData } from "@/lib/local-store";
import type {
  CalendarItem,
  AiGeneratedApp,
  KanbanBoard,
  KanbanBoardShare,
  Note,
  Page,
  Space,
  User,
  UserAiSettings,
  UserCategory,
  UserNotificationSettings,
  UserPreferenceSettings,
  UserPrivacySettings,
  UserProfileSettings,
  UserSettings,
  UserSubscriptionSettings,
  Whiteboard,
  CategoryScope,
} from "@/db/schema";

export type CalendarInput = {
  title: string;
  description: string | null;
  itemType: CalendarItemType;
  category: CalendarCategory;
  categoryId: number | null;
  scheduledDate: string | null;
};

export type BoardInput = {
  name: string;
  color: string;
};

export type TaskInput = {
  boardId: number;
  columnId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: KanbanPriority;
  categoryId: number | null;
  labels: KanbanLabel[];
  syncCalendar: boolean;
  linkNotes: boolean;
};

export type NoteInput = {
  title: string;
  content: NoteContent;
  plainText: string;
  wordCount: number;
};

export type UserSettingsPatch = Partial<{
  profile: Partial<UserProfileSettings>;
  subscription: Partial<UserSubscriptionSettings>;
  preferences: Partial<UserPreferenceSettings>;
  notifications: Partial<UserNotificationSettings>;
  ai: Partial<UserAiSettings>;
  privacy: Partial<UserPrivacySettings>;
}>;

export type UserCategoryInput = {
  scope: CategoryScope;
  name: string;
  color: string;
  icon: string;
};

export type WhiteboardScene = {
  elements: Record<string, unknown>[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

export type WhiteboardInput = {
  name: string;
  color: string;
};

export type SpaceMember = { initials: string; name: string; color: string };
export type SpaceColor = "violet" | "indigo" | "sky" | "emerald" | "amber" | "rose" | "slate";
export type WorkspacePageTemplate = "blank" | "project-plan" | "meeting-notes" | "prd" | "research-notes" | "task-plan";

export type SpaceInput = {
  name: string;
  description: string;
  color: SpaceColor;
};

export type PageInput = {
  spaceId: number;
  name: string;
  template: WorkspacePageTemplate;
  description: string;
};

export type SpaceWithPageCount = Space & { pageCount: number };
export type PageWithSpace = Page & { space: Space };

export type AiGeneratedAppInput = {
  appJson: AiTemplateAppJson;
};

export type DashboardSummary = {
  counts: {
    calendarItems: number;
    kanbanBoards: number;
    kanbanTasks: number;
    notes: number;
    spaces: number;
    pages: number;
    whiteboards: number;
    aiGeneratedApps: number;
  };
  todayItems: CalendarItem[];
  recentSpaces: SpaceWithPageCount[];
  recentNotes: Note[];
  recentWhiteboards: Whiteboard[];
};

async function cloudDb() {
  return import("@/db");
}

const defaultSettingsFor = (user: User): Omit<UserSettings, "id" | "createdAt" | "updatedAt"> => ({
  userId: user.id,
  profile: {
    displayName: user.name || user.email,
    avatarUrl: "",
  },
  subscription: {
    plan: "Free",
    status: "Active",
    renewalDate: null,
    usageLimit: "3 boards, 25 notes, 3 generated apps",
  },
  preferences: {
    theme: "system",
    defaultCalendarView: "month",
    defaultTaskPriority: "medium",
    autoSave: true,
  },
  notifications: {
    emailNotifications: true,
    taskReminders: true,
    calendarDigest: false,
    aiUpdates: true,
  },
  ai: {
    preferredModel: "",
    defaultBehavior: "Helpful, concise, and workspace-aware",
    tone: "Warm and professional",
    aiRefine: true,
    aiAssistant: true,
    aiTemplateBuilder: true,
    aiDiagram: true,
  },
  privacy: {
    profileVisibility: "private",
    activityTracking: true,
    twoFactorReminder: true,
    dataRetention: "standard",
  },
});

const defaultCategoryInputs: UserCategoryInput[] = [
  { scope: "calendar", name: "Work", color: "teal", icon: "Briefcase" },
  { scope: "calendar", name: "Personal", color: "rose", icon: "Heart" },
  { scope: "calendar", name: "Focus", color: "amber", icon: "Target" },
  { scope: "reminder", name: "Work", color: "teal", icon: "Briefcase" },
  { scope: "reminder", name: "Personal", color: "rose", icon: "Heart" },
  { scope: "reminder", name: "Focus", color: "amber", icon: "Target" },
  { scope: "task", name: "Low priority", color: "sky", icon: "ArrowDown" },
  { scope: "task", name: "Medium priority", color: "amber", icon: "Equal" },
  { scope: "task", name: "High priority", color: "rose", icon: "Flame" },
  { scope: "note", name: "Amber", color: "amber", icon: "FileText" },
  { scope: "note", name: "Teal", color: "teal", icon: "FileText" },
  { scope: "note", name: "Sky", color: "sky", icon: "FileText" },
  { scope: "note", name: "Rose", color: "rose", icon: "FileText" },
  { scope: "note", name: "Emerald", color: "emerald", icon: "FileText" },
  { scope: "note", name: "Violet", color: "violet", icon: "FileText" },
  { scope: "note", name: "Slate", color: "slate", icon: "FileText" },
];

function categoryForLegacyCalendar(categories: UserCategory[], legacy: CalendarCategory, itemType: CalendarItemType) {
  const scope: CategoryScope = itemType === "reminder" ? "reminder" : "calendar";
  const preferred = legacy === "personal" ? "personal" : legacy === "focus" ? "focus" : "work";
  return (
    categories.find((category) => category.scope === scope && category.name.toLowerCase().includes(preferred)) ??
    categories.find((category) => category.scope === scope) ??
    null
  );
}

function categoryForPriority(categories: UserCategory[], priority: KanbanPriority) {
  return (
    categories.find((category) => category.scope === "task" && category.name.toLowerCase().includes(priority)) ??
    categories.find((category) => category.scope === "task") ??
    null
  );
}

function categoryForNoteColor(categories: UserCategory[], color: string) {
  return (
    categories.find((category) => category.scope === "note" && category.color === color) ??
    categories.find((category) => category.scope === "note") ??
    null
  );
}

export async function ensureUserDefaults(user: User) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      if (!data.userSettings.some((settings) => settings.userId === user.id)) {
        const timestamp = localIds.now();
        data.userSettings.push({
          id: localIds.nextId(data, "userSettings"),
          ...defaultSettingsFor(user),
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      if (!data.userCategories.some((category) => category.userId === user.id)) {
        const timestamp = localIds.now();
        data.userCategories.push(
          ...defaultCategoryInputs.map((input, position) => ({
            id: localIds.nextId(data, "userCategories"),
            userId: user.id,
            ...input,
            position,
            createdAt: timestamp,
            updatedAt: timestamp,
          }))
        );
      }

      const userCategories = data.userCategories.filter((category) => category.userId === user.id);
      data.calendarItems
        .filter((item) => item.userId === user.id && !item.categoryId)
        .forEach((item) => {
          item.categoryId = categoryForLegacyCalendar(userCategories, item.category, item.itemType)?.id ?? null;
        });
      data.kanbanTasks.forEach((task) => {
        const board = data.kanbanBoards.find((current) => current.id === task.boardId);
        if (board?.userId === user.id && !task.categoryId) {
          task.categoryId = categoryForPriority(userCategories, task.priority)?.id ?? null;
        }
      });
      data.notes
        .filter((note) => note.userId === user.id && !note.categoryId)
        .forEach((note) => {
          note.categoryId = categoryForNoteColor(userCategories, note.color)?.id ?? null;
        });
    });
    return;
  }

  const { calendarItems, db, kanbanBoards, kanbanTasks, notes, userCategories, userSettings } = await cloudDb();
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1);
  if (!settings) {
    await db.insert(userSettings).values(defaultSettingsFor(user));
  }

  const categoryRows = await db.select().from(userCategories).where(eq(userCategories.userId, user.id));
  let categories = categoryRows;
  if (categoryRows.length === 0) {
    await db.insert(userCategories).values(defaultCategoryInputs.map((input, position) => ({ userId: user.id, ...input, position })));
    categories = await db.select().from(userCategories).where(eq(userCategories.userId, user.id));
  }

  const [calendarRows, taskRows, noteRows, boardRows] = await Promise.all([
    db.select().from(calendarItems).where(eq(calendarItems.userId, user.id)),
    db.select().from(kanbanTasks),
    db.select().from(notes).where(eq(notes.userId, user.id)),
    db.select().from(kanbanBoards).where(eq(kanbanBoards.userId, user.id)),
  ]);
  const boardIds = new Set(boardRows.map((board) => board.id));

  await Promise.all([
    ...calendarRows
      .filter((item) => !item.categoryId)
      .map((item) =>
        db
          .update(calendarItems)
          .set({ categoryId: categoryForLegacyCalendar(categories, item.category, item.itemType)?.id ?? null })
          .where(eq(calendarItems.id, item.id))
      ),
    ...taskRows
      .filter((task) => boardIds.has(task.boardId) && !task.categoryId)
      .map((task) =>
        db
          .update(kanbanTasks)
          .set({ categoryId: categoryForPriority(categories, task.priority)?.id ?? null })
          .where(eq(kanbanTasks.id, task.id))
      ),
    ...noteRows
      .filter((note) => !note.categoryId)
      .map((note) =>
        db
          .update(notes)
          .set({ categoryId: categoryForNoteColor(categories, note.color)?.id ?? null })
          .where(eq(notes.id, note.id))
      ),
  ]);
}

export async function getSettingsForUser(user: User) {
  await ensureUserDefaults(user);

  if (isLocalMode()) {
    const data = await getLocalData();
    const settings = data.userSettings.find((current) => current.userId === user.id);
    if (!settings) throw new Error("Settings not found.");
    return settings;
  }

  const { db, userSettings } = await cloudDb();
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, user.id)).limit(1);
  if (!settings) throw new Error("Settings not found.");
  return settings;
}

export async function updateSettingsForUser(userId: number, patch: UserSettingsPatch) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const settings = data.userSettings.find((current) => current.userId === userId);
      if (!settings) throw new Error("Settings not found.");
      if (patch.profile) settings.profile = { ...settings.profile, ...patch.profile };
      if (patch.subscription) settings.subscription = { ...settings.subscription, ...patch.subscription };
      if (patch.preferences) settings.preferences = { ...settings.preferences, ...patch.preferences };
      if (patch.notifications) settings.notifications = { ...settings.notifications, ...patch.notifications };
      if (patch.ai) settings.ai = { ...settings.ai, ...patch.ai };
      if (patch.privacy) settings.privacy = { ...settings.privacy, ...patch.privacy };
      settings.updatedAt = localIds.now();
    });
    return;
  }

  const { db, userSettings } = await cloudDb();
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  if (!settings) throw new Error("Settings not found.");
  await db
    .update(userSettings)
    .set({
      profile: patch.profile ? { ...settings.profile, ...patch.profile } : settings.profile,
      subscription: patch.subscription ? { ...settings.subscription, ...patch.subscription } : settings.subscription,
      preferences: patch.preferences ? { ...settings.preferences, ...patch.preferences } : settings.preferences,
      notifications: patch.notifications ? { ...settings.notifications, ...patch.notifications } : settings.notifications,
      ai: patch.ai ? { ...settings.ai, ...patch.ai } : settings.ai,
      privacy: patch.privacy ? { ...settings.privacy, ...patch.privacy } : settings.privacy,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId));
}

export async function listCategoriesForUser(userId: number) {
  if (isLocalMode()) {
    const data = await getLocalData();
    return data.userCategories
      .filter((category) => category.userId === userId)
      .sort((first, second) => first.scope.localeCompare(second.scope) || first.position - second.position || first.createdAt.getTime() - second.createdAt.getTime());
  }

  const { db, userCategories } = await cloudDb();
  return db.select().from(userCategories).where(eq(userCategories.userId, userId)).orderBy(asc(userCategories.scope), asc(userCategories.position), asc(userCategories.createdAt));
}

export async function createCategoryForUser(userId: number, input: UserCategoryInput) {
  if (isLocalMode()) {
    return updateLocalData((data) => {
      const siblings = data.userCategories.filter((category) => category.userId === userId && category.scope === input.scope);
      const timestamp = localIds.now();
      const category: UserCategory = {
        id: localIds.nextId(data, "userCategories"),
        userId,
        ...input,
        position: siblings.length,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      data.userCategories.push(category);
      return category.id;
    });
  }

  const { db, userCategories } = await cloudDb();
  const siblings = await db.select({ id: userCategories.id }).from(userCategories).where(and(eq(userCategories.userId, userId), eq(userCategories.scope, input.scope)));
  const [category] = await db.insert(userCategories).values({ userId, ...input, position: siblings.length }).returning({ id: userCategories.id });
  return category.id;
}

export async function updateCategoryForUser(userId: number, categoryId: number, input: UserCategoryInput) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const category = data.userCategories.find((current) => current.id === categoryId && current.userId === userId);
      if (!category) throw new Error("Category not found.");
      Object.assign(category, input, { updatedAt: localIds.now() });
    });
    return;
  }

  const { db, userCategories } = await cloudDb();
  await db.update(userCategories).set({ ...input, updatedAt: new Date() }).where(and(eq(userCategories.id, categoryId), eq(userCategories.userId, userId)));
}

export async function deleteCategoryForUser(userId: number, categoryId: number) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const category = data.userCategories.find((current) => current.id === categoryId && current.userId === userId);
      if (!category) throw new Error("Category not found.");
      const fallback = data.userCategories.find((current) => current.userId === userId && current.scope === category.scope && current.id !== category.id);
      if (!fallback) throw new Error("Keep at least one category in each section.");

      if (category.scope === "calendar" || category.scope === "reminder") {
        data.calendarItems
          .filter((item) => item.userId === userId && item.categoryId === category.id)
          .forEach((item) => {
            item.categoryId = fallback.id;
            item.updatedAt = localIds.now();
          });
      }
      if (category.scope === "task") {
        const ownedBoardIds = new Set(data.kanbanBoards.filter((board) => board.userId === userId).map((board) => board.id));
        data.kanbanTasks
          .filter((task) => ownedBoardIds.has(task.boardId) && task.categoryId === category.id)
          .forEach((task) => {
            task.categoryId = fallback.id;
            task.updatedAt = localIds.now();
          });
      }
      if (category.scope === "note") {
        data.notes
          .filter((note) => note.userId === userId && note.categoryId === category.id)
          .forEach((note) => {
            note.categoryId = fallback.id;
            note.color = fallback.color as NoteColor;
            note.icon = fallback.icon;
            note.updatedAt = localIds.now();
          });
      }
      data.userCategories = data.userCategories.filter((current) => current.id !== category.id);
    });
    return;
  }

  const { calendarItems, db, kanbanBoards, kanbanTasks, notes, userCategories } = await cloudDb();
  const [category] = await db.select().from(userCategories).where(and(eq(userCategories.id, categoryId), eq(userCategories.userId, userId))).limit(1);
  if (!category) throw new Error("Category not found.");
  const [fallback] = await db
    .select()
    .from(userCategories)
    .where(and(eq(userCategories.userId, userId), eq(userCategories.scope, category.scope), ne(userCategories.id, category.id)))
    .orderBy(asc(userCategories.position), asc(userCategories.createdAt))
    .limit(1);
  if (!fallback) throw new Error("Keep at least one category in each section.");

  if (category.scope === "calendar" || category.scope === "reminder") {
    await db.update(calendarItems).set({ categoryId: fallback.id, updatedAt: new Date() }).where(and(eq(calendarItems.userId, userId), eq(calendarItems.categoryId, category.id)));
  }
  if (category.scope === "task") {
    const boards = await db.select({ id: kanbanBoards.id }).from(kanbanBoards).where(eq(kanbanBoards.userId, userId));
    const boardIds = boards.map((board) => board.id);
    if (boardIds.length) {
      await db.update(kanbanTasks).set({ categoryId: fallback.id, updatedAt: new Date() }).where(and(inArray(kanbanTasks.boardId, boardIds), eq(kanbanTasks.categoryId, category.id)));
    }
  }
  if (category.scope === "note") {
    await db
      .update(notes)
      .set({ categoryId: fallback.id, color: fallback.color as NoteColor, icon: fallback.icon, updatedAt: new Date() })
      .where(and(eq(notes.userId, userId), eq(notes.categoryId, category.id)));
  }
  await db.delete(userCategories).where(and(eq(userCategories.id, category.id), eq(userCategories.userId, userId)));
}

export async function getAiSettingsForUser(user: User) {
  const settings = await getSettingsForUser(user);
  return settings.ai;
}

export async function upsertCloudUser(email: string, name: string | null) {
  const { db, users } = await cloudDb();
  await db.insert(users).values({ email, name }).onConflictDoUpdate({ target: users.email, set: { name } });
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function getDashboardSummary(user: User): Promise<DashboardSummary> {
  await ensureUserDefaults(user);
  const today = new Date().toISOString().slice(0, 10);

  if (isLocalMode()) {
    const data = await getLocalData();
    const ownedBoardIds = new Set(data.kanbanBoards.filter((board) => board.userId === user.id).map((board) => board.id));
    const visibleNotes = data.notes.filter((note) => note.userId === user.id && !note.isDeleted);
    const spacesForUser = data.spaces.filter((space) => space.userId === user.id && !space.isArchived);
    const pagesForUser = data.pages.filter((page) => page.userId === user.id && !page.isArchived);
    const calendarItemsForUser = data.calendarItems.filter((item) => item.userId === user.id);
    const recentSpaces = spacesForUser
      .map((space) => ({
        ...space,
        pageCount: pagesForUser.filter((page) => page.spaceId === space.id).length,
      }))
      .sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())
      .slice(0, 4);

    return {
      counts: {
        calendarItems: calendarItemsForUser.length,
        kanbanBoards: ownedBoardIds.size,
        kanbanTasks: data.kanbanTasks.filter((task) => ownedBoardIds.has(task.boardId)).length,
        notes: visibleNotes.length,
        spaces: spacesForUser.length,
        pages: pagesForUser.length,
        whiteboards: data.whiteboards.filter((whiteboard) => whiteboard.userId === user.id).length,
        aiGeneratedApps: data.aiGeneratedApps.filter((app) => app.userId === user.id).length,
      },
      todayItems: calendarItemsForUser.filter((item) => item.scheduledDate === today).slice(0, 5),
      recentSpaces,
      recentNotes: visibleNotes.sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime()).slice(0, 4),
      recentWhiteboards: data.whiteboards
        .filter((whiteboard) => whiteboard.userId === user.id)
        .sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())
        .slice(0, 3),
    };
  }

  const { aiGeneratedApps, calendarItems, db, kanbanBoards, kanbanTasks, notes, pages, spaces, whiteboards } = await cloudDb();
  const [calendarRows, boardRows, taskRows, noteRows, spaceRows, pageRows, whiteboardRows, appRows] = await Promise.all([
    db.select().from(calendarItems).where(eq(calendarItems.userId, user.id)),
    db.select().from(kanbanBoards).where(eq(kanbanBoards.userId, user.id)),
    db.select().from(kanbanTasks),
    db.select().from(notes).where(eq(notes.userId, user.id)),
    db.select().from(spaces).where(eq(spaces.userId, user.id)),
    db.select().from(pages).where(eq(pages.userId, user.id)),
    db.select().from(whiteboards).where(eq(whiteboards.userId, user.id)),
    db.select().from(aiGeneratedApps).where(eq(aiGeneratedApps.userId, user.id)),
  ]);
  const ownedBoardIds = new Set(boardRows.map((board) => board.id));
  const visibleNotes = noteRows.filter((note) => !note.isDeleted);
  const visibleSpaces = spaceRows.filter((space) => !space.isArchived);
  const visiblePages = pageRows.filter((page) => !page.isArchived);

  return {
    counts: {
      calendarItems: calendarRows.length,
      kanbanBoards: boardRows.length,
      kanbanTasks: taskRows.filter((task) => ownedBoardIds.has(task.boardId)).length,
      notes: visibleNotes.length,
      spaces: visibleSpaces.length,
      pages: visiblePages.length,
      whiteboards: whiteboardRows.length,
      aiGeneratedApps: appRows.length,
    },
    todayItems: calendarRows.filter((item) => item.scheduledDate === today).slice(0, 5),
    recentSpaces: visibleSpaces
      .map((space) => ({ ...space, pageCount: visiblePages.filter((page) => page.spaceId === space.id).length }))
      .sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())
      .slice(0, 4),
    recentNotes: visibleNotes.sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime()).slice(0, 4),
    recentWhiteboards: whiteboardRows.sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime()).slice(0, 3),
  };
}

export async function listCalendarItems(userId: number) {
  if (isLocalMode()) {
    const data = await getLocalData();
    return data.calendarItems
      .filter((item) => item.userId === userId)
      .sort((first, second) => {
        const firstDate = first.scheduledDate ?? "";
        const secondDate = second.scheduledDate ?? "";
        return firstDate.localeCompare(secondDate) || first.createdAt.getTime() - second.createdAt.getTime();
      });
  }

  const { calendarItems, db } = await cloudDb();
  return db
    .select()
    .from(calendarItems)
    .where(eq(calendarItems.userId, userId))
    .orderBy(asc(calendarItems.scheduledDate), asc(calendarItems.createdAt));
}

export async function createCalendarItemForUser(userId: number, input: CalendarInput) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const timestamp = localIds.now();
      data.calendarItems.push({
        id: localIds.nextId(data, "calendarItems"),
        userId,
        ...input,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
    return;
  }

  const { calendarItems, db } = await cloudDb();
  await db.insert(calendarItems).values({ userId, ...input });
}

export async function updateCalendarItemForUser(userId: number, itemId: number, input: CalendarInput) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const item = data.calendarItems.find((current) => current.id === itemId && current.userId === userId);
      if (item) {
        Object.assign(item, input, { updatedAt: localIds.now() });
      }
    });
    return;
  }

  const { calendarItems, db } = await cloudDb();
  await db.update(calendarItems).set({ ...input, updatedAt: new Date() }).where(and(eq(calendarItems.id, itemId), eq(calendarItems.userId, userId)));
}

export async function moveCalendarItemForUser(userId: number, itemId: number, scheduledDate: string | null) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const item = data.calendarItems.find((current) => current.id === itemId && current.userId === userId);
      if (item) {
        item.scheduledDate = scheduledDate;
        item.updatedAt = localIds.now();
      }
    });
    return;
  }

  const { calendarItems, db } = await cloudDb();
  await db.update(calendarItems).set({ scheduledDate, updatedAt: new Date() }).where(and(eq(calendarItems.id, itemId), eq(calendarItems.userId, userId)));
}

function isBoardMember(data: { kanbanBoards: KanbanBoard[]; kanbanBoardShares: KanbanBoardShare[] }, boardId: number, userId: number) {
  const board = data.kanbanBoards.find((current) => current.id === boardId);
  if (!board) {
    return null;
  }

  if (board.userId === userId) {
    return { board, role: "owner" as const };
  }

  const share = data.kanbanBoardShares.find((current) => current.boardId === boardId && current.userId === userId);
  return share ? { board, role: "member" as const } : null;
}

export async function getKanbanData(user: User) {
  if (isLocalMode()) {
    const data = await getLocalData();
    const ownedBoards = data.kanbanBoards.filter((board) => board.userId === user.id);
    const sharedBoards = data.kanbanBoardShares
      .filter((share) => share.userId === user.id)
      .map((share) => data.kanbanBoards.find((board) => board.id === share.boardId))
      .filter(Boolean) as KanbanBoard[];
    const boards = [...ownedBoards, ...sharedBoards].sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime());
    const boardIds = boards.map((board) => board.id);
    const columns = data.kanbanColumns
      .filter((column) => boardIds.includes(column.boardId))
      .sort((first, second) => first.position - second.position || first.createdAt.getTime() - second.createdAt.getTime());
    const tasks = data.kanbanTasks
      .filter((task) => boardIds.includes(task.boardId))
      .sort((first, second) => first.position - second.position || first.createdAt.getTime() - second.createdAt.getTime());
    const collaboratorsByBoard = new Map<number, { id: number; name: string; email: string; role: "owner" | "member" }[]>();

    for (const board of boards) {
      const owner = data.users.find((current) => current.id === board.userId);
      if (owner) {
        collaboratorsByBoard.set(board.id, [{ id: owner.id, name: owner.name || owner.email, email: owner.email, role: "owner" }]);
      }

      data.kanbanBoardShares
        .filter((share) => share.boardId === board.id)
        .forEach((share) => {
          const member = data.users.find((current) => current.id === share.userId);
          if (member) {
            collaboratorsByBoard.set(board.id, [
              ...(collaboratorsByBoard.get(board.id) ?? []),
              { id: member.id, name: member.name || member.email, email: member.email, role: "member" },
            ]);
          }
        });
    }

    return { boards, columns, tasks, collaboratorsByBoard };
  }

  const { db, kanbanBoardShares, kanbanBoards, kanbanColumns, kanbanTasks, users } = await cloudDb();
  const [ownedBoards, sharedBoardRows] = await Promise.all([
    db.select().from(kanbanBoards).where(eq(kanbanBoards.userId, user.id)).orderBy(asc(kanbanBoards.createdAt)),
    db
      .select({
        id: kanbanBoards.id,
        userId: kanbanBoards.userId,
        name: kanbanBoards.name,
        color: kanbanBoards.color,
        createdAt: kanbanBoards.createdAt,
        updatedAt: kanbanBoards.updatedAt,
      })
      .from(kanbanBoardShares)
      .innerJoin(kanbanBoards, eq(kanbanBoardShares.boardId, kanbanBoards.id))
      .where(eq(kanbanBoardShares.userId, user.id))
      .orderBy(asc(kanbanBoards.createdAt)),
  ]);
  const boards = [...ownedBoards, ...sharedBoardRows];
  const boardIds = boards.map((board) => board.id);
  const [columns, tasks, ownerRows, shareRows] =
    boardIds.length === 0
      ? [[], [], [], []]
      : await Promise.all([
          db.select().from(kanbanColumns).where(inArray(kanbanColumns.boardId, boardIds)).orderBy(asc(kanbanColumns.position), asc(kanbanColumns.createdAt)),
          db.select().from(kanbanTasks).where(inArray(kanbanTasks.boardId, boardIds)).orderBy(asc(kanbanTasks.position), asc(kanbanTasks.createdAt)),
          db
            .select({ boardId: kanbanBoards.id, userId: users.id, name: users.name, email: users.email })
            .from(kanbanBoards)
            .innerJoin(users, eq(kanbanBoards.userId, users.id))
            .where(inArray(kanbanBoards.id, boardIds)),
          db
            .select({ boardId: kanbanBoardShares.boardId, userId: users.id, name: users.name, email: users.email })
            .from(kanbanBoardShares)
            .innerJoin(users, eq(kanbanBoardShares.userId, users.id))
            .where(inArray(kanbanBoardShares.boardId, boardIds)),
        ]);
  const collaboratorsByBoard = new Map<number, { id: number; name: string; email: string; role: "owner" | "member" }[]>();
  for (const row of ownerRows) {
    collaboratorsByBoard.set(row.boardId, [...(collaboratorsByBoard.get(row.boardId) ?? []), { id: row.userId, name: row.name || row.email, email: row.email, role: "owner" }]);
  }
  for (const row of shareRows) {
    collaboratorsByBoard.set(row.boardId, [...(collaboratorsByBoard.get(row.boardId) ?? []), { id: row.userId, name: row.name || row.email, email: row.email, role: "member" }]);
  }
  return { boards, columns, tasks, collaboratorsByBoard };
}

const defaultColumnNames = ["Todo", "In Progress", "Done"];

export async function createKanbanBoardForUser(userId: number, input: BoardInput) {
  if (isLocalMode()) {
    return updateLocalData((data) => {
      const timestamp = localIds.now();
      const boardId = localIds.nextId(data, "kanbanBoards");
      data.kanbanBoards.push({ id: boardId, userId, name: input.name, color: input.color, createdAt: timestamp, updatedAt: timestamp });
      data.kanbanColumns.push(
        ...defaultColumnNames.map((name, position) => ({
          id: localIds.nextId(data, "kanbanColumns"),
          boardId,
          name,
          position,
          createdAt: timestamp,
          updatedAt: timestamp,
        }))
      );
      return boardId;
    });
  }

  const { db, kanbanBoards, kanbanColumns } = await cloudDb();
  const [board] = await db.insert(kanbanBoards).values({ userId, ...input }).returning({ id: kanbanBoards.id });
  await db.insert(kanbanColumns).values(defaultColumnNames.map((name, position) => ({ boardId: board.id, name, position })));
  return board.id;
}

export async function shareKanbanBoardForUser(userId: number, boardId: number, email: string) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const membership = isBoardMember(data, boardId, userId);
      if (!membership || membership.role !== "owner") {
        throw new Error("Only the board owner can invite collaborators.");
      }
      const targetUser = data.users.find((user) => user.email === email);
      if (!targetUser) {
        throw new Error("That user has not joined this workspace yet.");
      }
      if (targetUser.id === userId) {
        throw new Error("You already own this board.");
      }
      const exists = data.kanbanBoardShares.some((share) => share.boardId === boardId && share.userId === targetUser.id);
      if (!exists) {
        data.kanbanBoardShares.push({ id: localIds.nextId(data, "kanbanBoardShares"), boardId, userId: targetUser.id, createdAt: localIds.now() });
      }
    });
    return;
  }

  const { db, kanbanBoardShares, kanbanBoards, users } = await cloudDb();
  const [board] = await db.select().from(kanbanBoards).where(eq(kanbanBoards.id, boardId)).limit(1);
  if (!board || board.userId !== userId) {
    throw new Error("Only the board owner can invite collaborators.");
  }
  const [targetUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!targetUser) {
    throw new Error("That user has not joined this workspace yet.");
  }
  if (targetUser.id === userId) {
    throw new Error("You already own this board.");
  }
  await db.insert(kanbanBoardShares).values({ boardId, userId: targetUser.id }).onConflictDoNothing({ target: [kanbanBoardShares.boardId, kanbanBoardShares.userId] });
}

export async function createKanbanColumnForUser(userId: number, boardId: number, name: string) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      if (!isBoardMember(data, boardId, userId)) {
        throw new Error("Board not found.");
      }
      const columns = data.kanbanColumns.filter((column) => column.boardId === boardId);
      if (columns.length >= 5) {
        throw new Error("Boards can have up to 5 columns.");
      }
      data.kanbanColumns.push({ id: localIds.nextId(data, "kanbanColumns"), boardId, name, position: columns.length, createdAt: localIds.now(), updatedAt: localIds.now() });
    });
    return;
  }

  const { db, kanbanColumns } = await cloudDb();
  const columns = await db.select({ id: kanbanColumns.id }).from(kanbanColumns).where(eq(kanbanColumns.boardId, boardId));
  if (columns.length >= 5) {
    throw new Error("Boards can have up to 5 columns.");
  }
  await db.insert(kanbanColumns).values({ boardId, name, position: columns.length });
}

export async function updateKanbanColumnForUser(userId: number, columnId: number, name: string) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const column = data.kanbanColumns.find((current) => current.id === columnId);
      if (!column || !isBoardMember(data, column.boardId, userId)) {
        throw new Error("Column not found.");
      }
      column.name = name;
      column.updatedAt = localIds.now();
    });
    return;
  }

  const { db, kanbanColumns } = await cloudDb();
  await db.update(kanbanColumns).set({ name, updatedAt: new Date() }).where(eq(kanbanColumns.id, columnId));
}

export async function deleteKanbanColumnForUser(userId: number, columnId: number) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const column = data.kanbanColumns.find((current) => current.id === columnId);
      if (!column || !isBoardMember(data, column.boardId, userId)) {
        throw new Error("Column not found.");
      }
      const remainingColumns = data.kanbanColumns.filter((current) => current.boardId === column.boardId && current.id !== columnId);
      if (remainingColumns.length === 0) {
        throw new Error("A board needs at least one column.");
      }
      data.kanbanTasks.filter((task) => task.columnId === columnId).forEach((task) => {
        task.columnId = remainingColumns[0].id;
        task.updatedAt = localIds.now();
      });
      data.kanbanColumns = data.kanbanColumns.filter((current) => current.id !== columnId);
    });
    return;
  }

  const { db, kanbanColumns, kanbanTasks } = await cloudDb();
  const [column] = await db.select().from(kanbanColumns).where(eq(kanbanColumns.id, columnId)).limit(1);
  if (!column) throw new Error("Column not found.");
  const remainingColumns = await db.select().from(kanbanColumns).where(and(eq(kanbanColumns.boardId, column.boardId), ne(kanbanColumns.id, columnId))).orderBy(asc(kanbanColumns.position), asc(kanbanColumns.createdAt));
  if (remainingColumns.length === 0) throw new Error("A board needs at least one column.");
  await db.update(kanbanTasks).set({ columnId: remainingColumns[0].id, updatedAt: new Date() }).where(eq(kanbanTasks.columnId, columnId));
  await db.delete(kanbanColumns).where(eq(kanbanColumns.id, columnId));
}

function calendarCategoryForPriority(priority: KanbanPriority): CalendarCategory {
  if (priority === "high") return "focus";
  if (priority === "low") return "personal";
  return "work";
}

export async function createKanbanTaskForUser(userId: number, input: TaskInput) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const membership = isBoardMember(data, input.boardId, userId);
      const column = data.kanbanColumns.find((current) => current.id === input.columnId);
      if (!membership || !column || column.boardId !== input.boardId) {
        throw new Error("Column does not belong to this board.");
      }
      let calendarItemId: number | null = null;
      const syncCalendar = membership.role === "owner" ? input.syncCalendar : false;
      if (syncCalendar) {
        calendarItemId = localIds.nextId(data, "calendarItems");
        data.calendarItems.push({
          id: calendarItemId,
          userId: membership.board.userId,
          title: input.title,
          description: input.description,
          itemType: "task",
          category: calendarCategoryForPriority(input.priority),
          categoryId: input.categoryId,
          scheduledDate: input.dueDate,
          createdAt: localIds.now(),
          updatedAt: localIds.now(),
        });
      }
      const siblings = data.kanbanTasks.filter((task) => task.columnId === input.columnId);
      data.kanbanTasks.push({
        id: localIds.nextId(data, "kanbanTasks"),
        ...input,
        syncCalendar,
        calendarItemId,
        position: siblings.length,
        createdAt: localIds.now(),
        updatedAt: localIds.now(),
      });
    });
    return;
  }

  const { db, kanbanTasks } = await cloudDb();
  const siblings = await db.select({ id: kanbanTasks.id }).from(kanbanTasks).where(eq(kanbanTasks.columnId, input.columnId));
  await db.insert(kanbanTasks).values({ ...input, position: siblings.length });
}

export async function updateKanbanTaskForUser(userId: number, taskId: number, input: TaskInput) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const task = data.kanbanTasks.find((current) => current.id === taskId);
      const membership = isBoardMember(data, input.boardId, userId);
      const column = data.kanbanColumns.find((current) => current.id === input.columnId);
      if (!task || !membership || !column || column.boardId !== input.boardId || task.boardId !== input.boardId) {
        throw new Error("Task does not belong to this board.");
      }
      const syncCalendar = membership.role === "owner" ? input.syncCalendar : task.syncCalendar;
      Object.assign(task, input, { syncCalendar, updatedAt: localIds.now() });
      if (syncCalendar) {
        if (task.calendarItemId) {
          const calendarItem = data.calendarItems.find((item) => item.id === task.calendarItemId && item.userId === membership.board.userId);
          if (calendarItem) {
            Object.assign(calendarItem, {
              title: input.title,
              description: input.description,
              category: calendarCategoryForPriority(input.priority),
              categoryId: input.categoryId,
              scheduledDate: input.dueDate,
              updatedAt: localIds.now(),
            });
          }
        } else {
          task.calendarItemId = localIds.nextId(data, "calendarItems");
          data.calendarItems.push({
            id: task.calendarItemId,
            userId: membership.board.userId,
            title: input.title,
            description: input.description,
            itemType: "task",
            category: calendarCategoryForPriority(input.priority),
            categoryId: input.categoryId,
            scheduledDate: input.dueDate,
            createdAt: localIds.now(),
            updatedAt: localIds.now(),
          });
        }
      } else if (task.calendarItemId) {
        data.calendarItems = data.calendarItems.filter((item) => item.id !== task.calendarItemId);
        task.calendarItemId = null;
      }
    });
    return;
  }

  const { db, kanbanTasks } = await cloudDb();
  await db.update(kanbanTasks).set({ ...input, updatedAt: new Date() }).where(eq(kanbanTasks.id, taskId));
}

export async function deleteKanbanTaskForUser(userId: number, taskId: number) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const task = data.kanbanTasks.find((current) => current.id === taskId);
      if (!task || !isBoardMember(data, task.boardId, userId)) {
        throw new Error("Task not found.");
      }
      data.kanbanTasks = data.kanbanTasks.filter((current) => current.id !== taskId);
      if (task.calendarItemId) {
        data.calendarItems = data.calendarItems.filter((item) => item.id !== task.calendarItemId);
      }
    });
    return;
  }

  const { db, kanbanTasks } = await cloudDb();
  await db.delete(kanbanTasks).where(eq(kanbanTasks.id, taskId));
}

export async function moveKanbanTaskForUser(userId: number, taskId: number, columnId: number) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const task = data.kanbanTasks.find((current) => current.id === taskId);
      const column = data.kanbanColumns.find((current) => current.id === columnId);
      if (!task || !column || !isBoardMember(data, task.boardId, userId) || task.boardId !== column.boardId) {
        throw new Error("Task and column are on different boards.");
      }
      const siblings = data.kanbanTasks.filter((current) => current.columnId === columnId && current.id !== taskId);
      task.columnId = columnId;
      task.position = siblings.length;
      task.updatedAt = localIds.now();
    });
    return;
  }

  const { db, kanbanTasks } = await cloudDb();
  const siblings = await db.select({ id: kanbanTasks.id }).from(kanbanTasks).where(and(eq(kanbanTasks.columnId, columnId), ne(kanbanTasks.id, taskId)));
  await db.update(kanbanTasks).set({ columnId, position: siblings.length, updatedAt: new Date() }).where(eq(kanbanTasks.id, taskId));
}

export async function listNotes(userId: number) {
  if (isLocalMode()) {
    const data = await getLocalData();
    return data.notes
      .filter((note) => note.userId === userId)
      .sort((first, second) => Number(second.isPinned) - Number(first.isPinned) || second.updatedAt.getTime() - first.updatedAt.getTime());
  }

  const { db, notes } = await cloudDb();
  return db.select().from(notes).where(eq(notes.userId, userId)).orderBy(desc(notes.isPinned), desc(notes.updatedAt));
}

export async function createNoteForUser(userId: number, content: NoteContent) {
  if (isLocalMode()) {
    return updateLocalData((data) => {
      const category = data.userCategories.find((current) => current.userId === userId && current.scope === "note");
      const note: Note = {
        id: localIds.nextId(data, "notes"),
        userId,
        title: "Untitled note",
        icon: category?.icon ?? "FileText",
        color: category?.color ?? "amber",
        categoryId: category?.id ?? null,
        content,
        plainText: "",
        wordCount: 0,
        isPinned: false,
        isDeleted: false,
        deletedAt: null,
        createdAt: localIds.now(),
        updatedAt: localIds.now(),
      };
      data.notes.push(note);
      return note.id;
    });
  }

  const { db, notes, userCategories } = await cloudDb();
  const [category] = await db.select().from(userCategories).where(and(eq(userCategories.userId, userId), eq(userCategories.scope, "note"))).orderBy(asc(userCategories.position), asc(userCategories.createdAt)).limit(1);
  const [createdNote] = await db
    .insert(notes)
    .values({ userId, title: "Untitled note", icon: category?.icon ?? "FileText", color: category?.color ?? "amber", categoryId: category?.id ?? null, content, plainText: "", wordCount: 0 })
    .returning({ id: notes.id });
  return createdNote.id;
}

export async function listAiGeneratedApps(userId: number) {
  if (isLocalMode()) {
    const data = await getLocalData();
    return data.aiGeneratedApps
      .filter((app) => app.userId === userId)
      .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime());
  }

  const { aiGeneratedApps, db } = await cloudDb();
  return db.select().from(aiGeneratedApps).where(eq(aiGeneratedApps.userId, userId)).orderBy(desc(aiGeneratedApps.createdAt));
}

export async function listSidebarAiGeneratedApps(userId: number) {
  if (isLocalMode()) {
    const data = await getLocalData();
    return data.aiGeneratedApps
      .filter((app) => app.userId === userId && app.isInSidebar)
      .sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime());
  }

  const { aiGeneratedApps, db } = await cloudDb();
  return db
    .select()
    .from(aiGeneratedApps)
    .where(and(eq(aiGeneratedApps.userId, userId), eq(aiGeneratedApps.isInSidebar, true)))
    .orderBy(asc(aiGeneratedApps.createdAt));
}

export async function getAiGeneratedAppForUser(userId: number, appId: number) {
  if (isLocalMode()) {
    const data = await getLocalData();
    return data.aiGeneratedApps.find((app) => app.id === appId && app.userId === userId) ?? null;
  }

  const { aiGeneratedApps, db } = await cloudDb();
  const [app] = await db
    .select()
    .from(aiGeneratedApps)
    .where(and(eq(aiGeneratedApps.id, appId), eq(aiGeneratedApps.userId, userId)))
    .limit(1);
  return app ?? null;
}

export async function createAiGeneratedAppForUser(userId: number, input: AiGeneratedAppInput) {
  if (isLocalMode()) {
    return updateLocalData((data) => {
      const timestamp = localIds.now();
      const app: AiGeneratedApp = {
        id: localIds.nextId(data, "aiGeneratedApps"),
        userId,
        appJson: input.appJson,
        isInSidebar: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      data.aiGeneratedApps.push(app);
      return app.id;
    });
  }

  const { aiGeneratedApps, db } = await cloudDb();
  const [createdApp] = await db
    .insert(aiGeneratedApps)
    .values({ userId, appJson: input.appJson })
    .returning({ id: aiGeneratedApps.id });
  return createdApp.id;
}

export async function setAiGeneratedAppSidebarForUser(userId: number, appId: number, isInSidebar: boolean) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const app = data.aiGeneratedApps.find((current) => current.id === appId && current.userId === userId);
      if (!app) throw new Error("Generated app not found.");
      const sidebarCount = data.aiGeneratedApps.filter((current) => current.userId === userId && current.isInSidebar && current.id !== appId).length;
      if (isInSidebar && sidebarCount >= 3) {
        throw new Error("You can add up to 3 generated apps to the sidebar.");
      }
      app.isInSidebar = isInSidebar;
      app.updatedAt = localIds.now();
    });
    return;
  }

  const { aiGeneratedApps, db } = await cloudDb();
  const [app] = await db
    .select()
    .from(aiGeneratedApps)
    .where(and(eq(aiGeneratedApps.id, appId), eq(aiGeneratedApps.userId, userId)))
    .limit(1);
  if (!app) throw new Error("Generated app not found.");
  if (isInSidebar) {
    const sidebarApps = await db
      .select({ id: aiGeneratedApps.id })
      .from(aiGeneratedApps)
      .where(and(eq(aiGeneratedApps.userId, userId), eq(aiGeneratedApps.isInSidebar, true), ne(aiGeneratedApps.id, appId)));
    if (sidebarApps.length >= 3) {
      throw new Error("You can add up to 3 generated apps to the sidebar.");
    }
  }

  await db
    .update(aiGeneratedApps)
    .set({ isInSidebar, updatedAt: new Date() })
    .where(and(eq(aiGeneratedApps.id, appId), eq(aiGeneratedApps.userId, userId)));
}

export async function deleteAiGeneratedAppForUser(userId: number, appId: number) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      data.aiGeneratedApps = data.aiGeneratedApps.filter((app) => app.id !== appId || app.userId !== userId);
    });
    return;
  }

  const { aiGeneratedApps, db } = await cloudDb();
  await db.delete(aiGeneratedApps).where(and(eq(aiGeneratedApps.id, appId), eq(aiGeneratedApps.userId, userId)));
}

async function updateOwnedNote(userId: number, noteId: number, updater: (note: Note) => void) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const note = data.notes.find((current) => current.id === noteId && current.userId === userId);
      if (!note) throw new Error("Note not found.");
      updater(note);
    });
    return;
  }
}

export async function updateNoteForUser(userId: number, noteId: number, input: NoteInput) {
  if (isLocalMode()) {
    await updateOwnedNote(userId, noteId, (note) => Object.assign(note, input, { updatedAt: localIds.now() }));
    return;
  }

  const { db, notes } = await cloudDb();
  await db.update(notes).set({ ...input, updatedAt: new Date() }).where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
}

export async function renameNoteForUser(userId: number, noteId: number, title: string) {
  if (isLocalMode()) {
    await updateOwnedNote(userId, noteId, (note) => Object.assign(note, { title, updatedAt: localIds.now() }));
    return;
  }

  const { db, notes } = await cloudDb();
  await db.update(notes).set({ title, updatedAt: new Date() }).where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
}

export async function duplicateNoteForUser(userId: number, noteId: number) {
  if (isLocalMode()) {
    return updateLocalData((data) => {
      const note = data.notes.find((current) => current.id === noteId && current.userId === userId);
      if (!note) throw new Error("Note not found.");
      const duplicate: Note = { ...note, id: localIds.nextId(data, "notes"), title: `${note.title} Copy`.slice(0, 120), isPinned: false, isDeleted: false, deletedAt: null, createdAt: localIds.now(), updatedAt: localIds.now() };
      data.notes.push(duplicate);
      return duplicate.id;
    });
  }

  const { db, notes } = await cloudDb();
  const [note] = await db.select().from(notes).where(and(eq(notes.id, noteId), eq(notes.userId, userId))).limit(1);
  if (!note) throw new Error("Note not found.");
  const [createdNote] = await db.insert(notes).values({ userId, title: `${note.title} Copy`.slice(0, 120), icon: note.icon, color: note.color, content: note.content, plainText: note.plainText, wordCount: note.wordCount }).returning({ id: notes.id });
  return createdNote.id;
}

export async function setNotePinForUser(userId: number, noteId: number, isPinned: boolean) {
  if (isLocalMode()) {
    await updateOwnedNote(userId, noteId, (note) => Object.assign(note, { isPinned, updatedAt: localIds.now() }));
    return;
  }

  const { db, notes } = await cloudDb();
  await db.update(notes).set({ isPinned, updatedAt: new Date() }).where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
}

export async function setNoteColorForUser(userId: number, noteId: number, color: NoteColor) {
  if (isLocalMode()) {
    await updateOwnedNote(userId, noteId, (note) => Object.assign(note, { color, updatedAt: localIds.now() }));
    return;
  }

  const { db, notes } = await cloudDb();
  await db.update(notes).set({ color, updatedAt: new Date() }).where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
}

export async function setNoteCategoryForUser(userId: number, noteId: number, categoryId: number) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const category = data.userCategories.find((current) => current.id === categoryId && current.userId === userId && current.scope === "note");
      if (!category) throw new Error("Category not found.");
      const note = data.notes.find((current) => current.id === noteId && current.userId === userId);
      if (!note) throw new Error("Note not found.");
      note.categoryId = category.id;
      note.color = category.color as NoteColor;
      note.icon = category.icon;
      note.updatedAt = localIds.now();
    });
    return;
  }

  const { db, notes, userCategories } = await cloudDb();
  const [category] = await db.select().from(userCategories).where(and(eq(userCategories.id, categoryId), eq(userCategories.userId, userId), eq(userCategories.scope, "note"))).limit(1);
  if (!category) throw new Error("Category not found.");
  await db
    .update(notes)
    .set({ categoryId: category.id, color: category.color as NoteColor, icon: category.icon, updatedAt: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
}

export async function setNoteTrashForUser(userId: number, noteId: number, isDeleted: boolean) {
  if (isLocalMode()) {
    await updateOwnedNote(userId, noteId, (note) => Object.assign(note, { isDeleted, deletedAt: isDeleted ? localIds.now() : null, updatedAt: localIds.now() }));
    return;
  }

  const { db, notes } = await cloudDb();
  await db.update(notes).set({ isDeleted, deletedAt: isDeleted ? new Date() : null, updatedAt: new Date() }).where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
}

export async function deleteNoteForUser(userId: number, noteId: number) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      data.notes = data.notes.filter((note) => note.id !== noteId || note.userId !== userId);
    });
    return;
  }

  const { db, notes } = await cloudDb();
  await db.delete(notes).where(and(eq(notes.id, noteId), eq(notes.userId, userId)));
}

const emptyWhiteboardScene: WhiteboardScene = {
  elements: [],
  appState: {
    viewBackgroundColor: "#f8fafc",
    currentItemStrokeColor: "#1f2937",
    currentItemBackgroundColor: "transparent",
  },
  files: {},
};

export async function listWhiteboards(userId: number) {
  if (isLocalMode()) {
    const data = await getLocalData();
    return data.whiteboards
      .filter((whiteboard) => whiteboard.userId === userId)
      .sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime());
  }

  const { db, whiteboards } = await cloudDb();
  return db.select().from(whiteboards).where(eq(whiteboards.userId, userId)).orderBy(desc(whiteboards.updatedAt));
}

export async function createWhiteboardForUser(userId: number, input: WhiteboardInput) {
  if (isLocalMode()) {
    return updateLocalData((data) => {
      const timestamp = localIds.now();
      const whiteboard: Whiteboard = {
        id: localIds.nextId(data, "whiteboards"),
        userId,
        name: input.name,
        color: input.color,
        elements: emptyWhiteboardScene.elements,
        appState: emptyWhiteboardScene.appState,
        files: emptyWhiteboardScene.files,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      data.whiteboards.push(whiteboard);
      return whiteboard.id;
    });
  }

  const { db, whiteboards } = await cloudDb();
  const [createdWhiteboard] = await db
    .insert(whiteboards)
    .values({
      userId,
      name: input.name,
      color: input.color,
      elements: emptyWhiteboardScene.elements,
      appState: emptyWhiteboardScene.appState,
      files: emptyWhiteboardScene.files,
    })
    .returning({ id: whiteboards.id });
  return createdWhiteboard.id;
}

async function updateOwnedWhiteboard(userId: number, whiteboardId: number, updater: (whiteboard: Whiteboard) => void) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const whiteboard = data.whiteboards.find((current) => current.id === whiteboardId && current.userId === userId);
      if (!whiteboard) throw new Error("Whiteboard not found.");
      updater(whiteboard);
    });
  }
}

export async function renameWhiteboardForUser(userId: number, whiteboardId: number, name: string) {
  if (isLocalMode()) {
    await updateOwnedWhiteboard(userId, whiteboardId, (whiteboard) => Object.assign(whiteboard, { name, updatedAt: localIds.now() }));
    return;
  }

  const { db, whiteboards } = await cloudDb();
  await db.update(whiteboards).set({ name, updatedAt: new Date() }).where(and(eq(whiteboards.id, whiteboardId), eq(whiteboards.userId, userId)));
}

export async function updateWhiteboardSceneForUser(userId: number, whiteboardId: number, scene: WhiteboardScene) {
  if (isLocalMode()) {
    await updateOwnedWhiteboard(userId, whiteboardId, (whiteboard) =>
      Object.assign(whiteboard, {
        elements: scene.elements,
        appState: scene.appState,
        files: scene.files,
        updatedAt: localIds.now(),
      })
    );
    return;
  }

  const { db, whiteboards } = await cloudDb();
  await db
    .update(whiteboards)
    .set({ elements: scene.elements, appState: scene.appState, files: scene.files, updatedAt: new Date() })
    .where(and(eq(whiteboards.id, whiteboardId), eq(whiteboards.userId, userId)));
}

export async function deleteWhiteboardForUser(userId: number, whiteboardId: number) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      data.whiteboards = data.whiteboards.filter((whiteboard) => whiteboard.id !== whiteboardId || whiteboard.userId !== userId);
    });
    return;
  }

  const { db, whiteboards } = await cloudDb();
  await db.delete(whiteboards).where(and(eq(whiteboards.id, whiteboardId), eq(whiteboards.userId, userId)));
}

function initialsFor(user: User) {
  const source = user.name || user.email;
  const parts = source
    .replace(/@.*/, "")
    .split(/\s+/)
    .filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function ownerMember(user: User): SpaceMember {
  return { initials: initialsFor(user), name: user.name || user.email, color: "bg-violet-500" };
}

function ensureSpaceAccess(data: { spaces: Space[] }, userId: number, spaceId: number) {
  const space = data.spaces.find((current) => current.id === spaceId && current.userId === userId);
  if (!space) {
    throw new Error("Space not found.");
  }
  return space;
}

function ensurePageAccess(data: { spaces: Space[]; pages: Page[] }, userId: number, pageId: number) {
  const page = data.pages.find((current) => current.id === pageId && current.userId === userId);
  if (!page) {
    throw new Error("Page not found.");
  }
  const space = ensureSpaceAccess(data, userId, page.spaceId);
  return { page, space };
}

function touchSpaceForPage(data: { spaces: Space[] }, spaceId: number) {
  const space = data.spaces.find((current) => current.id === spaceId);
  if (space) {
    space.updatedAt = localIds.now();
  }
}

export async function listSpacesWithPageCounts(userId: number) {
  if (isLocalMode()) {
    const data = await getLocalData();
    return data.spaces
      .filter((space) => space.userId === userId)
      .map((space) => ({
        ...space,
        pageCount: data.pages.filter((page) => page.spaceId === space.id && !page.isArchived).length,
      }))
      .sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime());
  }

  const { db, spaces, pages } = await cloudDb();
  const spaceRows = await db.select().from(spaces).where(eq(spaces.userId, userId)).orderBy(desc(spaces.updatedAt));
  const spaceIds = spaceRows.map((space) => space.id);
  const pageRows = spaceIds.length ? await db.select().from(pages).where(inArray(pages.spaceId, spaceIds)) : [];
  return spaceRows.map((space) => ({ ...space, pageCount: pageRows.filter((page) => page.spaceId === space.id && !page.isArchived).length }));
}

export async function getSpacePagesForUser(userId: number, spaceId: number) {
  if (isLocalMode()) {
    return updateLocalData((data) => {
      const space = ensureSpaceAccess(data, userId, spaceId);
      const timestamp = localIds.now();
      space.lastOpenedAt = timestamp;
      const pageRows = data.pages
        .filter((page) => page.spaceId === space.id)
        .sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime());
      return { space: { ...space }, pages: pageRows.map((page) => ({ ...page })) };
    });
  }

  const { db, pages, spaces } = await cloudDb();
  const [space] = await db.select().from(spaces).where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId))).limit(1);
  if (!space) throw new Error("Space not found.");
  await db.update(spaces).set({ lastOpenedAt: new Date() }).where(eq(spaces.id, space.id));
  const pageRows = await db.select().from(pages).where(and(eq(pages.spaceId, space.id), eq(pages.userId, userId))).orderBy(desc(pages.updatedAt));
  return { space, pages: pageRows };
}

export async function getPageDetailForUser(userId: number, spaceId: number, pageId: number) {
  if (isLocalMode()) {
    return updateLocalData((data) => {
      const { page, space } = ensurePageAccess(data, userId, pageId);
      if (page.spaceId !== spaceId) {
        throw new Error("Page not found.");
      }
      const timestamp = localIds.now();
      page.lastOpenedAt = timestamp;
      space.lastOpenedAt = timestamp;
      return { page: { ...page, space: { ...space } } };
    });
  }

  const { db, pages, spaces } = await cloudDb();
  const [space] = await db.select().from(spaces).where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId))).limit(1);
  if (!space) throw new Error("Space not found.");
  const [page] = await db.select().from(pages).where(and(eq(pages.id, pageId), eq(pages.spaceId, spaceId), eq(pages.userId, userId))).limit(1);
  if (!page) throw new Error("Page not found.");
  await Promise.all([
    db.update(pages).set({ lastOpenedAt: new Date() }).where(eq(pages.id, page.id)),
    db.update(spaces).set({ lastOpenedAt: new Date() }).where(eq(spaces.id, space.id)),
  ]);
  return { page: { ...page, space } };
}

export async function createSpaceForUser(user: User, input: SpaceInput) {
  if (isLocalMode()) {
    return updateLocalData((data) => {
      const timestamp = localIds.now();
      const space: Space = {
        id: localIds.nextId(data, "spaces"),
        userId: user.id,
        name: input.name,
        description: input.description,
        color: input.color,
        isFavorite: false,
        isArchived: false,
        members: [ownerMember(user)],
        lastOpenedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      data.spaces.push(space);
      return space.id;
    });
  }

  const { db, spaces } = await cloudDb();
  const [space] = await db.insert(spaces).values({ userId: user.id, ...input, members: [ownerMember(user)] }).returning({ id: spaces.id });
  return space.id;
}

export async function updateSpaceForUser(userId: number, spaceId: number, input: Partial<SpaceInput>) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const space = ensureSpaceAccess(data, userId, spaceId);
      Object.assign(space, input, { updatedAt: localIds.now() });
    });
    return;
  }

  const { db, spaces } = await cloudDb();
  await db.update(spaces).set({ ...input, updatedAt: new Date() }).where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId)));
}

export async function addSpaceMemberForUser(userId: number, spaceId: number, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const member: SpaceMember = {
    initials: normalizedEmail.slice(0, 2).toUpperCase(),
    name: normalizedEmail,
    color: "bg-sky-500",
  };

  if (isLocalMode()) {
    await updateLocalData((data) => {
      const space = ensureSpaceAccess(data, userId, spaceId);
      if (!space.members.some((current) => current.name.toLowerCase() === normalizedEmail)) {
        space.members = [...space.members, member].slice(0, 12);
      }
      space.updatedAt = localIds.now();
    });
    return;
  }

  const { db, spaces } = await cloudDb();
  const [space] = await db.select().from(spaces).where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId))).limit(1);
  if (!space) throw new Error("Space not found.");
  const members = space.members.some((current) => current.name.toLowerCase() === normalizedEmail)
    ? space.members
    : [...space.members, member].slice(0, 12);
  await db.update(spaces).set({ members, updatedAt: new Date() }).where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId)));
}

export async function setSpaceFavoriteForUser(userId: number, spaceId: number, isFavorite: boolean) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const space = ensureSpaceAccess(data, userId, spaceId);
      space.isFavorite = isFavorite;
      space.updatedAt = localIds.now();
    });
    return;
  }

  const { db, spaces } = await cloudDb();
  await db.update(spaces).set({ isFavorite, updatedAt: new Date() }).where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId)));
}

export async function setSpaceArchiveForUser(userId: number, spaceId: number, isArchived: boolean) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const space = ensureSpaceAccess(data, userId, spaceId);
      space.isArchived = isArchived;
      space.updatedAt = localIds.now();
    });
    return;
  }

  const { db, spaces } = await cloudDb();
  await db.update(spaces).set({ isArchived, updatedAt: new Date() }).where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId)));
}

export async function duplicateSpaceForUser(userId: number, spaceId: number) {
  if (isLocalMode()) {
    return updateLocalData((data) => {
      const source = ensureSpaceAccess(data, userId, spaceId);
      const timestamp = localIds.now();
      const newSpaceId = localIds.nextId(data, "spaces");
      data.spaces.push({
        ...source,
        id: newSpaceId,
        name: `${source.name} Copy`.slice(0, 120),
        isFavorite: false,
        isArchived: false,
        lastOpenedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      data.pages
        .filter((page) => page.spaceId === source.id)
        .forEach((page) => {
          data.pages.push({
            ...page,
            id: localIds.nextId(data, "pages"),
            spaceId: newSpaceId,
            isFavorite: false,
            lastOpenedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        });
      return newSpaceId;
    });
  }

  const { db, pages, spaces } = await cloudDb();
  const [source] = await db.select().from(spaces).where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId))).limit(1);
  if (!source) throw new Error("Space not found.");
  const [copy] = await db
    .insert(spaces)
    .values({ userId, name: `${source.name} Copy`.slice(0, 120), description: source.description, color: source.color, members: source.members })
    .returning({ id: spaces.id });
  const sourcePages = await db.select().from(pages).where(and(eq(pages.spaceId, source.id), eq(pages.userId, userId)));
  if (sourcePages.length) {
    await db.insert(pages).values(
      sourcePages.map((page) => ({
        userId,
        spaceId: copy.id,
        name: page.name,
        template: page.template,
        description: page.description,
        commentsCount: page.commentsCount,
        linkedTasksCount: page.linkedTasksCount,
        lastEditedBy: page.lastEditedBy,
      }))
    );
  }
  return copy.id;
}

export async function deleteSpaceForUser(userId: number, spaceId: number) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      ensureSpaceAccess(data, userId, spaceId);
      data.pages = data.pages.filter((page) => page.spaceId !== spaceId);
      data.spaces = data.spaces.filter((space) => space.id !== spaceId);
    });
    return;
  }

  const { db, pages, spaces } = await cloudDb();
  await db.delete(pages).where(and(eq(pages.spaceId, spaceId), eq(pages.userId, userId)));
  await db.delete(spaces).where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId)));
}

export async function createPageForUser(user: User, input: PageInput) {
  if (isLocalMode()) {
    return updateLocalData((data) => {
      const space = ensureSpaceAccess(data, user.id, input.spaceId);
      const timestamp = localIds.now();
      const page: Page = {
        id: localIds.nextId(data, "pages"),
        userId: user.id,
        spaceId: input.spaceId,
        name: input.name,
        template: input.template,
        description: input.description,
        isFavorite: false,
        isArchived: false,
        commentsCount: 0,
        linkedTasksCount: 0,
        lastEditedBy: initialsFor(user),
        lastOpenedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      data.pages.push(page);
      space.updatedAt = timestamp;
      return page.id;
    });
  }

  const { db, pages, spaces } = await cloudDb();
  const [space] = await db.select().from(spaces).where(and(eq(spaces.id, input.spaceId), eq(spaces.userId, user.id))).limit(1);
  if (!space) throw new Error("Space not found.");
  const [page] = await db.insert(pages).values({ userId: user.id, ...input, lastEditedBy: initialsFor(user) }).returning({ id: pages.id });
  await db.update(spaces).set({ updatedAt: new Date() }).where(eq(spaces.id, input.spaceId));
  return page.id;
}

export async function updatePageForUser(userId: number, pageId: number, input: Partial<Omit<PageInput, "spaceId">> & { spaceId?: number }) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const { page } = ensurePageAccess(data, userId, pageId);
      if (input.spaceId !== undefined) {
        ensureSpaceAccess(data, userId, input.spaceId);
        page.spaceId = input.spaceId;
      }
      Object.assign(page, input, { updatedAt: localIds.now() });
      touchSpaceForPage(data, page.spaceId);
    });
    return;
  }

  const { db, pages, spaces } = await cloudDb();
  if (input.spaceId !== undefined) {
    const [space] = await db.select().from(spaces).where(and(eq(spaces.id, input.spaceId), eq(spaces.userId, userId))).limit(1);
    if (!space) throw new Error("Space not found.");
  }
  await db.update(pages).set({ ...input, updatedAt: new Date() }).where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
  if (input.spaceId !== undefined) {
    await db.update(spaces).set({ updatedAt: new Date() }).where(eq(spaces.id, input.spaceId));
  }
}

export async function setPageFavoriteForUser(userId: number, pageId: number, isFavorite: boolean) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const { page } = ensurePageAccess(data, userId, pageId);
      page.isFavorite = isFavorite;
      page.updatedAt = localIds.now();
      touchSpaceForPage(data, page.spaceId);
    });
    return;
  }

  const { db, pages } = await cloudDb();
  await db.update(pages).set({ isFavorite, updatedAt: new Date() }).where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
}

export async function setPageArchiveForUser(userId: number, pageId: number, isArchived: boolean) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const { page } = ensurePageAccess(data, userId, pageId);
      page.isArchived = isArchived;
      page.updatedAt = localIds.now();
      touchSpaceForPage(data, page.spaceId);
    });
    return;
  }

  const { db, pages } = await cloudDb();
  await db.update(pages).set({ isArchived, updatedAt: new Date() }).where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
}

export async function duplicatePageForUser(userId: number, pageId: number) {
  if (isLocalMode()) {
    return updateLocalData((data) => {
      const { page } = ensurePageAccess(data, userId, pageId);
      const timestamp = localIds.now();
      const copy: Page = {
        ...page,
        id: localIds.nextId(data, "pages"),
        name: `${page.name} Copy`.slice(0, 120),
        isFavorite: false,
        lastOpenedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      data.pages.push(copy);
      touchSpaceForPage(data, copy.spaceId);
      return copy.id;
    });
  }

  const { db, pages } = await cloudDb();
  const [page] = await db.select().from(pages).where(and(eq(pages.id, pageId), eq(pages.userId, userId))).limit(1);
  if (!page) throw new Error("Page not found.");
  const [copy] = await db
    .insert(pages)
    .values({
      userId,
      spaceId: page.spaceId,
      name: `${page.name} Copy`.slice(0, 120),
      template: page.template,
      description: page.description,
      commentsCount: page.commentsCount,
      linkedTasksCount: page.linkedTasksCount,
      lastEditedBy: page.lastEditedBy,
    })
    .returning({ id: pages.id });
  return copy.id;
}

export async function deletePageForUser(userId: number, pageId: number) {
  if (isLocalMode()) {
    await updateLocalData((data) => {
      const { page } = ensurePageAccess(data, userId, pageId);
      data.pages = data.pages.filter((current) => current.id !== page.id);
      touchSpaceForPage(data, page.spaceId);
    });
    return;
  }

  const { db, pages } = await cloudDb();
  await db.delete(pages).where(and(eq(pages.id, pageId), eq(pages.userId, userId)));
}
