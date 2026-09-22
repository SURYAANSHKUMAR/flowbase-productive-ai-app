"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentDbUser } from "@/lib/current-user";
import { createCalendarItemForUser, listCategoriesForUser, moveCalendarItemForUser, updateCalendarItemForUser } from "@/lib/workspace-data";

export type CalendarItemType = "task" | "reminder";
export type CalendarCategory = "work" | "personal" | "focus";

type CalendarItemInput = {
  title: string;
  description?: string;
  itemType: CalendarItemType;
  category: CalendarCategory;
  categoryId?: number | null;
  scheduledDate: string | null;
};

const itemTypes = new Set<CalendarItemType>(["task", "reminder"]);
const categories = new Set<CalendarCategory>(["work", "personal", "focus"]);

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
    throw new Error("Invalid calendar date.");
  }

  return value;
}

async function cleanCalendarItemInput(userId: number, input: CalendarItemInput) {
  const title = input.title.trim();

  if (!title) {
    throw new Error("Title is required.");
  }

  if (!itemTypes.has(input.itemType)) {
    throw new Error("Invalid item type.");
  }

  const categoryRows = await listCategoriesForUser(userId);
  const expectedScope = input.itemType === "reminder" ? "reminder" : "calendar";
  const selectedCategory =
    categoryRows.find((category) => category.id === input.categoryId && category.scope === expectedScope) ??
    categoryRows.find((category) => category.scope === expectedScope) ??
    null;

  const legacyName = selectedCategory?.name.toLowerCase() ?? input.category;
  const legacyCategory: CalendarCategory = legacyName.includes("personal") ? "personal" : legacyName.includes("focus") ? "focus" : "work";

  if (!categories.has(legacyCategory)) {
    throw new Error("Invalid category.");
  }

  return {
    title,
    description: input.description?.trim() || null,
    itemType: input.itemType,
    category: legacyCategory,
    categoryId: selectedCategory?.id ?? null,
    scheduledDate: cleanDate(input.scheduledDate),
  };
}

export async function createCalendarItem(input: CalendarItemInput) {
  const user = await requireCurrentDbUser();
  const values = await cleanCalendarItemInput(user.id, input);

  await createCalendarItemForUser(user.id, values);

  revalidatePath("/calendar");
}

export async function updateCalendarItem(itemId: number, input: CalendarItemInput) {
  const user = await requireCurrentDbUser();
  const values = await cleanCalendarItemInput(user.id, input);

  await updateCalendarItemForUser(user.id, itemId, values);

  revalidatePath("/calendar");
}

export async function moveCalendarItem(itemId: number, scheduledDate: string | null) {
  const user = await requireCurrentDbUser();

  await moveCalendarItemForUser(user.id, itemId, cleanDate(scheduledDate));

  revalidatePath("/calendar");
}
