"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentDbUser } from "@/lib/current-user";
import {
  createKanbanBoardForUser,
  createKanbanColumnForUser,
  createKanbanTaskForUser,
  deleteKanbanColumnForUser,
  deleteKanbanTaskForUser,
  moveKanbanTaskForUser,
  shareKanbanBoardForUser,
  updateKanbanColumnForUser,
  updateKanbanTaskForUser,
  listCategoriesForUser,
} from "@/lib/workspace-data";

export type KanbanPriority = "low" | "medium" | "high";
export type KanbanLabel = {
  name: string;
  color: string;
};

type BoardInput = {
  name: string;
  color: string;
};

type TaskInput = {
  boardId: number;
  columnId: number;
  title: string;
  description?: string;
  dueDate: string | null;
  priority: KanbanPriority;
  categoryId?: number | null;
  labels: KanbanLabel[];
  syncCalendar: boolean;
  linkNotes: boolean;
};

const allowedBoardColors = new Set(["teal", "sky", "rose", "amber", "emerald", "violet"]);
const allowedLabelColors = new Set(["teal", "sky", "rose", "amber", "emerald", "violet", "slate"]);
const priorities = new Set<KanbanPriority>(["low", "medium", "high"]);

function cleanName(value: string, label: string) {
  const name = value.trim();

  if (!name) {
    throw new Error(`${label} is required.`);
  }

  return name.slice(0, 80);
}

function cleanDate(value: string | null) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    throw new Error("Invalid due date.");
  }

  return value;
}

function cleanLabels(labels: KanbanLabel[]) {
  return labels
    .map((label) => ({
      name: label.name.trim().slice(0, 24),
      color: allowedLabelColors.has(label.color) ? label.color : "teal",
    }))
    .filter((label) => label.name)
    .slice(0, 6);
}

async function cleanTaskInput(userId: number, input: TaskInput) {
  if (!priorities.has(input.priority)) {
    throw new Error("Invalid priority.");
  }

  const categories = await listCategoriesForUser(userId);
  const selectedCategory =
    categories.find((category) => category.id === input.categoryId && category.scope === "task") ??
    categories.find((category) => category.scope === "task" && category.name.toLowerCase().includes(input.priority)) ??
    categories.find((category) => category.scope === "task") ??
    null;

  return {
    boardId: input.boardId,
    columnId: input.columnId,
    title: cleanName(input.title, "Title"),
    description: input.description?.trim() || null,
    dueDate: cleanDate(input.dueDate),
    priority: input.priority,
    categoryId: selectedCategory?.id ?? null,
    labels: cleanLabels(input.labels),
    syncCalendar: input.syncCalendar,
    linkNotes: input.linkNotes,
  };
}

function revalidateKanban() {
  revalidatePath("/kanban");
}

export async function createKanbanBoard(input: BoardInput) {
  const user = await requireCurrentDbUser();
  const boardId = await createKanbanBoardForUser(user.id, {
    name: cleanName(input.name, "Board name"),
    color: allowedBoardColors.has(input.color) ? input.color : "teal",
  });

  revalidateKanban();
  return boardId;
}

export async function shareKanbanBoard(boardId: number, email: string) {
  const user = await requireCurrentDbUser();
  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid email address.");
  }

  await shareKanbanBoardForUser(user.id, boardId, normalizedEmail);
  revalidateKanban();
}

export async function createKanbanColumn(boardId: number, name: string) {
  const user = await requireCurrentDbUser();
  await createKanbanColumnForUser(user.id, boardId, cleanName(name, "Column name"));
  revalidateKanban();
}

export async function updateKanbanColumn(columnId: number, name: string) {
  const user = await requireCurrentDbUser();
  await updateKanbanColumnForUser(user.id, columnId, cleanName(name, "Column name"));
  revalidateKanban();
}

export async function deleteKanbanColumn(columnId: number) {
  const user = await requireCurrentDbUser();
  await deleteKanbanColumnForUser(user.id, columnId);
  revalidateKanban();
}

export async function createKanbanTask(input: TaskInput) {
  const user = await requireCurrentDbUser();
  await createKanbanTaskForUser(user.id, await cleanTaskInput(user.id, input));
  revalidateKanban();
  revalidatePath("/calendar");
}

export async function updateKanbanTask(taskId: number, input: TaskInput) {
  const user = await requireCurrentDbUser();
  await updateKanbanTaskForUser(user.id, taskId, await cleanTaskInput(user.id, input));
  revalidateKanban();
  revalidatePath("/calendar");
}

export async function deleteKanbanTask(taskId: number) {
  const user = await requireCurrentDbUser();
  await deleteKanbanTaskForUser(user.id, taskId);
  revalidateKanban();
  revalidatePath("/calendar");
}

export async function moveKanbanTask(taskId: number, columnId: number) {
  const user = await requireCurrentDbUser();
  await moveKanbanTaskForUser(user.id, taskId, columnId);
  revalidateKanban();
}
