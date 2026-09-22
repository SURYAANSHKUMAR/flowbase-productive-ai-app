import "server-only";

import { promises as fs } from "fs";
import path from "path";

import type {
  AiGeneratedApp,
  CalendarItem,
  KanbanBoard,
  KanbanBoardShare,
  KanbanColumn,
  KanbanTask,
  Note,
  Page,
  Space,
  User,
  UserCategory,
  UserSettings,
  Whiteboard,
} from "@/db/schema";

type LocalData = {
  counters: Record<string, number>;
  users: User[];
  calendarItems: CalendarItem[];
  kanbanBoards: KanbanBoard[];
  kanbanColumns: KanbanColumn[];
  kanbanTasks: KanbanTask[];
  kanbanBoardShares: KanbanBoardShare[];
  notes: Note[];
  whiteboards: Whiteboard[];
  aiGeneratedApps: AiGeneratedApp[];
  userSettings: UserSettings[];
  userCategories: UserCategory[];
  spaces: Space[];
  pages: Page[];
};

const localDataFileName = process.env.FLOWBASE_LOCAL_DATA_PATH || ".flowbase-local-data.json";
const localDataPath = path.join(/* turbopackIgnore: true */ process.cwd(), localDataFileName);

const emptyData: LocalData = {
  counters: {},
  users: [],
  calendarItems: [],
  kanbanBoards: [],
  kanbanColumns: [],
  kanbanTasks: [],
  kanbanBoardShares: [],
  notes: [],
  whiteboards: [],
  aiGeneratedApps: [],
  userSettings: [],
  userCategories: [],
  spaces: [],
  pages: [],
};

function now() {
  return new Date();
}

function nextId(data: LocalData, key: keyof Omit<LocalData, "counters">) {
  const next = (data.counters[key] ?? 0) + 1;
  data.counters[key] = next;
  return next;
}

async function readData(): Promise<LocalData> {
  try {
    const raw = await fs.readFile(localDataPath, "utf8");
   const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as LocalData;
    return {
      ...emptyData,
      ...parsed,
      counters: { ...emptyData.counters, ...parsed.counters },
      users: (parsed.users ?? []).map((user) => ({ ...user, createdAt: new Date(user.createdAt) })),
      calendarItems: (parsed.calendarItems ?? []).map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })),
      kanbanBoards: (parsed.kanbanBoards ?? []).map((board) => ({
        ...board,
        createdAt: new Date(board.createdAt),
        updatedAt: new Date(board.updatedAt),
      })),
      kanbanColumns: (parsed.kanbanColumns ?? []).map((column) => ({
        ...column,
        createdAt: new Date(column.createdAt),
        updatedAt: new Date(column.updatedAt),
      })),
      kanbanTasks: (parsed.kanbanTasks ?? []).map((task) => ({
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
      })),
      kanbanBoardShares: (parsed.kanbanBoardShares ?? []).map((share) => ({
        ...share,
        createdAt: new Date(share.createdAt),
      })),
      notes: (parsed.notes ?? []).map((note) => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt),
        deletedAt: note.deletedAt ? new Date(note.deletedAt) : null,
      })),
      whiteboards: (parsed.whiteboards ?? []).map((whiteboard) => ({
        ...whiteboard,
        createdAt: new Date(whiteboard.createdAt),
        updatedAt: new Date(whiteboard.updatedAt),
      })),
      aiGeneratedApps: (parsed.aiGeneratedApps ?? []).map((app) => ({
        ...app,
        createdAt: new Date(app.createdAt),
        updatedAt: new Date(app.updatedAt),
      })),
      userSettings: (parsed.userSettings ?? []).map((settings) => ({
        ...settings,
        createdAt: new Date(settings.createdAt),
        updatedAt: new Date(settings.updatedAt),
      })),
      userCategories: (parsed.userCategories ?? []).map((category) => ({
        ...category,
        createdAt: new Date(category.createdAt),
        updatedAt: new Date(category.updatedAt),
      })),
      spaces: (parsed.spaces ?? []).map((space) => ({
        ...space,
        lastOpenedAt: space.lastOpenedAt ? new Date(space.lastOpenedAt) : null,
        createdAt: new Date(space.createdAt),
        updatedAt: new Date(space.updatedAt),
      })),
      pages: (parsed.pages ?? []).map((page) => ({
        ...page,
        lastOpenedAt: page.lastOpenedAt ? new Date(page.lastOpenedAt) : null,
        createdAt: new Date(page.createdAt),
        updatedAt: new Date(page.updatedAt),
      })),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return structuredClone(emptyData);
    }

    throw error;
  }
}

async function writeData(data: LocalData) {
  const tempPath = `${localDataPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, localDataPath);
}

export async function updateLocalData<T>(mutate: (data: LocalData) => T | Promise<T>) {
  const data = await readData();
  const result = await mutate(data);
  await writeData(data);
  return result;
}

export async function getLocalData() {
  return readData();
}

export async function upsertLocalUser(email: string, name: string | null) {
  return updateLocalData((data) => {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = data.users.find((user) => user.email === normalizedEmail);

    if (existing) {
      existing.name = name || existing.name || normalizedEmail;
      return existing;
    }

    const user: User = {
      id: nextId(data, "users"),
      name: name || normalizedEmail,
      email: normalizedEmail,
      createdAt: now(),
    };

    data.users.push(user);
    return user;
  });
}

export async function getLocalUserByEmail(email: string) {
  const data = await readData();
  return data.users.find((user) => user.email === email.trim().toLowerCase()) ?? null;
}

export async function getLocalUserById(userId: number) {
  const data = await readData();
  return data.users.find((user) => user.id === userId) ?? null;
}

export const localIds = { nextId, now };
