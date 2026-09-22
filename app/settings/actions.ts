"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentDbUser } from "@/lib/current-user";
import {
  createCategoryForUser,
  deleteCategoryForUser,
  getSettingsForUser,
  listCategoriesForUser,
  updateCategoryForUser,
  updateSettingsForUser,
  type UserCategoryInput,
  type UserSettingsPatch,
} from "@/lib/workspace-data";
import type { CategoryScope } from "@/db/schema";

const scopes = new Set<CategoryScope>(["calendar", "task", "note", "reminder"]);
const colors = new Set(["teal", "sky", "rose", "amber", "emerald", "violet", "slate", "fuchsia", "indigo"]);
const icons = new Set(["Briefcase", "Heart", "Target", "Bell", "ClipboardList", "FileText", "Flame", "Sparkles", "Tag", "CalendarDays", "Layers3", "Shield", "Star", "Zap", "ArrowDown", "Equal"]);
const models = new Set(["", "gpt-5.4-mini", "gpt-5.4", "gpt-5.4-codex", "gpt-4.1-mini"]);

function text(value: unknown, fallback: string, limit = 120) {
  const clean = typeof value === "string" ? value.trim() : "";
  return (clean || fallback).slice(0, limit);
}

function nullableDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function cleanCategory(input: UserCategoryInput): UserCategoryInput {
  if (!scopes.has(input.scope)) throw new Error("Invalid category section.");
  return {
    scope: input.scope,
    name: text(input.name, "New category", 48),
    color: colors.has(input.color) ? input.color : "teal",
    icon: icons.has(input.icon) ? input.icon : "Tag",
  };
}

export async function saveSettingsPatch(patch: UserSettingsPatch) {
  const user = await requireCurrentDbUser();
  const current = await getSettingsForUser(user);

  await updateSettingsForUser(user.id, {
    profile: patch.profile && {
      displayName: text(patch.profile.displayName, current.profile.displayName, 80),
      avatarUrl: typeof patch.profile.avatarUrl === "string" ? patch.profile.avatarUrl.trim().slice(0, 500) : current.profile.avatarUrl,
    },
    subscription: patch.subscription && {
      plan: text(patch.subscription.plan, current.subscription.plan, 40),
      status: text(patch.subscription.status, current.subscription.status, 40),
      renewalDate: nullableDate(patch.subscription.renewalDate),
      usageLimit: text(patch.subscription.usageLimit, current.subscription.usageLimit, 120),
    },
    preferences: patch.preferences && {
      theme: patch.preferences.theme === "light" || patch.preferences.theme === "dark" ? patch.preferences.theme : "system",
      defaultCalendarView: patch.preferences.defaultCalendarView === "week" ? "week" : "month",
      defaultTaskPriority: patch.preferences.defaultTaskPriority === "low" || patch.preferences.defaultTaskPriority === "high" ? patch.preferences.defaultTaskPriority : "medium",
      autoSave: bool(patch.preferences.autoSave, current.preferences.autoSave),
    },
    notifications: patch.notifications && {
      emailNotifications: bool(patch.notifications.emailNotifications, current.notifications.emailNotifications),
      taskReminders: bool(patch.notifications.taskReminders, current.notifications.taskReminders),
      calendarDigest: bool(patch.notifications.calendarDigest, current.notifications.calendarDigest),
      aiUpdates: bool(patch.notifications.aiUpdates, current.notifications.aiUpdates),
    },
    ai: patch.ai && {
      preferredModel: models.has(patch.ai.preferredModel ?? "") ? patch.ai.preferredModel ?? "" : "",
      defaultBehavior: text(patch.ai.defaultBehavior, current.ai.defaultBehavior, 160),
      tone: text(patch.ai.tone, current.ai.tone, 80),
      aiRefine: bool(patch.ai.aiRefine, current.ai.aiRefine),
      aiAssistant: bool(patch.ai.aiAssistant, current.ai.aiAssistant),
      aiTemplateBuilder: bool(patch.ai.aiTemplateBuilder, current.ai.aiTemplateBuilder),
      aiDiagram: bool(patch.ai.aiDiagram, current.ai.aiDiagram),
    },
    privacy: patch.privacy && {
      profileVisibility: patch.privacy.profileVisibility === "workspace" ? "workspace" : "private",
      activityTracking: bool(patch.privacy.activityTracking, current.privacy.activityTracking),
      twoFactorReminder: bool(patch.privacy.twoFactorReminder, current.privacy.twoFactorReminder),
      dataRetention: patch.privacy.dataRetention === "minimal" ? "minimal" : "standard",
    },
  });

  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/kanban");
}

export async function createCategory(input: UserCategoryInput) {
  const user = await requireCurrentDbUser();
  await createCategoryForUser(user.id, cleanCategory(input));
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/kanban");
  revalidatePath("/notes");
}

export async function updateCategory(categoryId: number, input: UserCategoryInput) {
  const user = await requireCurrentDbUser();
  await updateCategoryForUser(user.id, categoryId, cleanCategory(input));
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/kanban");
  revalidatePath("/notes");
}

export async function deleteCategory(categoryId: number) {
  const user = await requireCurrentDbUser();
  await deleteCategoryForUser(user.id, categoryId);
  revalidatePath("/settings");
  revalidatePath("/calendar");
  revalidatePath("/kanban");
  revalidatePath("/notes");
}

export async function exportSettingsData() {
  const user = await requireCurrentDbUser();
  const [settings, categories] = await Promise.all([getSettingsForUser(user), listCategoriesForUser(user.id)]);
  return {
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email, name: user.name },
    settings,
    categories,
  };
}
