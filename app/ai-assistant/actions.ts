"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";

import { generateTemplateApp } from "@/app/ai-template-builder/actions";
import type { CalendarCategory, CalendarItemType } from "@/app/calendar/actions";
import type { KanbanLabel, KanbanPriority } from "@/app/kanban/actions";
import type { NoteContent } from "@/app/notes/actions";
import { requireCurrentDbUser } from "@/lib/current-user";
import { configuredValue, assertConfigured } from "@/lib/env";
import {
  createCalendarItemForUser,
  createKanbanBoardForUser,
  createKanbanTaskForUser,
  createNoteForUser,
  createWhiteboardForUser,
  getAiSettingsForUser,
  getKanbanData,
  getSettingsForUser,
  listCategoriesForUser,
  updateNoteForUser,
  updateSettingsForUser,
  type UserSettingsPatch,
} from "@/lib/workspace-data";

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantAction =
  | {
      type: "create_kanban_board";
      boardName: string;
      color?: string;
    }
  | {
      type: "add_kanban_task";
      title: string;
      description?: string;
      boardName?: string;
      columnName?: string;
      dueDate?: string | null;
      priority?: KanbanPriority;
      labels?: KanbanLabel[];
      syncCalendar?: boolean;
    }
  | {
      type: "add_calendar_item";
      title: string;
      description?: string;
      itemType?: CalendarItemType;
      scheduledDate: string;
      category?: CalendarCategory;
    }
  | {
      type: "create_note";
      title: string;
      content: string;
    }
  | {
      type: "create_whiteboard_prompt";
      name: string;
      prompt: string;
      color?: string;
    }
  | {
      type: "generate_template_app";
      prompt: string;
    }
  | {
      type: "update_settings";
      patch: UserSettingsPatch;
      summary: string;
    };

export type AssistantActionResult = {
  label: string;
  href?: string;
};

export type AssistantResponse = {
  content: string;
  actionResult?: AssistantActionResult;
  pendingAction?: AssistantAction;
};

type ModelResponse = {
  mode: "answer" | "clarify" | "action" | "confirm";
  message: string;
  action?: AssistantAction;
};

const boardColors = new Set(["teal", "sky", "rose", "amber", "emerald", "violet"]);
const whiteboardColors = new Set(["teal", "sky", "rose", "amber", "emerald", "violet", "slate"]);
const labelColors = new Set(["teal", "sky", "rose", "amber", "emerald", "violet", "slate"]);
const priorities = new Set<KanbanPriority>(["low", "medium", "high"]);
const calendarItemTypes = new Set<CalendarItemType>(["task", "reminder"]);
const calendarCategories = new Set<CalendarCategory>(["work", "personal", "focus"]);

function cleanText(value: unknown, fallback: string, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maxLength);
}

function cleanOptionalText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = value.trim();
  const [year, month, day] = date.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    throw new Error("Use dates in YYYY-MM-DD format.");
  }

  return date;
}

function parseJsonOutput(output: string): ModelResponse {
  const trimmed = output.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI returned a response this assistant could not read.");
  }

  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Partial<ModelResponse>;
  const mode = parsed.mode === "clarify" || parsed.mode === "action" || parsed.mode === "confirm" ? parsed.mode : "answer";
  return {
    mode,
    message: cleanText(parsed.message, "I can help with that.", 1200),
    action: parsed.action,
  };
}

function plainTextToNoteContent(text: string): NoteContent {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 60);

  return {
    type: "doc",
    content: paragraphs.length
      ? paragraphs.map((paragraph) => ({
          type: "paragraph",
          content: [{ type: "text", text: paragraph }],
        }))
      : [{ type: "paragraph" }],
  };
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isConfirmation(message: string) {
  return /^(yes|yep|yeah|confirm|confirmed|go ahead|do it|save it|please do|ok|okay)\b/i.test(message.trim());
}

function sanitizeLabels(labels: unknown): KanbanLabel[] {
  if (!Array.isArray(labels)) {
    return [];
  }

  return labels
    .map((label) => {
      const record = label && typeof label === "object" ? (label as Record<string, unknown>) : {};
      const name = cleanOptionalText(record.name, 24);
      const color = typeof record.color === "string" && labelColors.has(record.color) ? record.color : "teal";
      return { name, color };
    })
    .filter((label) => label.name)
    .slice(0, 6);
}

function sanitizeSettingsPatch(value: UserSettingsPatch): UserSettingsPatch {
  const patch: UserSettingsPatch = {};

  if (value.preferences) {
    const preferences: NonNullable<UserSettingsPatch["preferences"]> = {};
    if (["system", "light", "dark"].includes(String(value.preferences.theme))) preferences.theme = value.preferences.theme;
    if (["month", "week"].includes(String(value.preferences.defaultCalendarView))) preferences.defaultCalendarView = value.preferences.defaultCalendarView;
    if (["low", "medium", "high"].includes(String(value.preferences.defaultTaskPriority))) preferences.defaultTaskPriority = value.preferences.defaultTaskPriority;
    if (typeof value.preferences.autoSave === "boolean") preferences.autoSave = value.preferences.autoSave;
    if (Object.keys(preferences).length) patch.preferences = preferences;
  }

  if (value.notifications) {
    const notifications: NonNullable<UserSettingsPatch["notifications"]> = {};
    if (typeof value.notifications.emailNotifications === "boolean") notifications.emailNotifications = value.notifications.emailNotifications;
    if (typeof value.notifications.taskReminders === "boolean") notifications.taskReminders = value.notifications.taskReminders;
    if (typeof value.notifications.calendarDigest === "boolean") notifications.calendarDigest = value.notifications.calendarDigest;
    if (typeof value.notifications.aiUpdates === "boolean") notifications.aiUpdates = value.notifications.aiUpdates;
    if (Object.keys(notifications).length) patch.notifications = notifications;
  }

  if (value.ai) {
    const ai: NonNullable<UserSettingsPatch["ai"]> = {};
    if (typeof value.ai.defaultBehavior === "string") ai.defaultBehavior = value.ai.defaultBehavior.slice(0, 240);
    if (typeof value.ai.tone === "string") ai.tone = value.ai.tone.slice(0, 120);
    if (typeof value.ai.aiRefine === "boolean") ai.aiRefine = value.ai.aiRefine;
    if (typeof value.ai.aiAssistant === "boolean") ai.aiAssistant = value.ai.aiAssistant;
    if (typeof value.ai.aiTemplateBuilder === "boolean") ai.aiTemplateBuilder = value.ai.aiTemplateBuilder;
    if (typeof value.ai.aiDiagram === "boolean") ai.aiDiagram = value.ai.aiDiagram;
    if (Object.keys(ai).length) patch.ai = ai;
  }

  if (value.privacy) {
    const privacy: NonNullable<UserSettingsPatch["privacy"]> = {};
    if (["private", "workspace"].includes(String(value.privacy.profileVisibility))) privacy.profileVisibility = value.privacy.profileVisibility;
    if (typeof value.privacy.activityTracking === "boolean") privacy.activityTracking = value.privacy.activityTracking;
    if (typeof value.privacy.twoFactorReminder === "boolean") privacy.twoFactorReminder = value.privacy.twoFactorReminder;
    if (["standard", "minimal"].includes(String(value.privacy.dataRetention))) privacy.dataRetention = value.privacy.dataRetention;
    if (Object.keys(privacy).length) patch.privacy = privacy;
  }

  return patch;
}

async function executeAction(action: AssistantAction): Promise<AssistantResponse> {
  const user = await requireCurrentDbUser();
  await getSettingsForUser(user);
  const categories = await listCategoriesForUser(user.id);

  if (action.type === "create_kanban_board") {
    await createKanbanBoardForUser(user.id, {
      name: cleanText(action.boardName, "New board", 80),
      color: action.color && boardColors.has(action.color) ? action.color : "teal",
    });
    revalidatePath("/kanban");
    return {
      content: `Done. I created the "${cleanText(action.boardName, "New board", 80)}" Kanban board with starter columns.`,
      actionResult: { label: "Open board", href: "/kanban" },
    };
  }

  if (action.type === "add_kanban_task") {
    const { boards, columns } = await getKanbanData(user);
    let board: (typeof boards)[number] | null = action.boardName ? boards.find((current) => current.name.toLowerCase() === action.boardName?.toLowerCase()) ?? null : boards[0] ?? null;
    if (!board && action.boardName) {
      const boardId = await createKanbanBoardForUser(user.id, {
        name: cleanText(action.boardName, "AI Tasks", 80),
        color: "teal",
      });
      const refreshed = await getKanbanData(user);
      board = refreshed.boards.find((current) => current.id === boardId) ?? null;
    }
    if (!board) {
      return { content: "Which Kanban board should I add that task to?" };
    }

    const boardColumns = columns.filter((column) => column.boardId === board.id).sort((first, second) => first.position - second.position);
    const column =
      (action.columnName ? boardColumns.find((current) => current.name.toLowerCase() === action.columnName?.toLowerCase()) : null) ??
      boardColumns[0] ??
      null;
    if (!column) {
      return { content: `I found "${board.name}", but it does not have a column yet. Create a column first, then I can add the task.` };
    }

    const priority = action.priority && priorities.has(action.priority) ? action.priority : "medium";
    const taskCategory =
      categories.find((category) => category.scope === "task" && category.name.toLowerCase().includes(priority)) ??
      categories.find((category) => category.scope === "task") ??
      null;
    await createKanbanTaskForUser(user.id, {
      boardId: board.id,
      columnId: column.id,
      title: cleanText(action.title, "New task", 80),
      description: cleanOptionalText(action.description, 500) || null,
      dueDate: cleanDate(action.dueDate),
      priority,
      categoryId: taskCategory?.id ?? null,
      labels: sanitizeLabels(action.labels),
      syncCalendar: Boolean(action.syncCalendar),
      linkNotes: false,
    });
    revalidatePath("/kanban");
    revalidatePath("/calendar");
    return {
      content: `Done. I added "${cleanText(action.title, "New task", 80)}" to ${board.name}.`,
      actionResult: { label: "Open Kanban", href: "/kanban" },
    };
  }

  if (action.type === "add_calendar_item") {
    const scheduledDate = cleanDate(action.scheduledDate);
    if (!scheduledDate) {
      return { content: "What date should I put that on? Use a date like 2026-06-29." };
    }
    const itemType = action.itemType && calendarItemTypes.has(action.itemType) ? action.itemType : "reminder";
    const expectedScope = itemType === "reminder" ? "reminder" : "calendar";
    const category = action.category && calendarCategories.has(action.category) ? action.category : "work";
    const selectedCategory =
      categories.find((current) => current.scope === expectedScope && current.name.toLowerCase().includes(category)) ??
      categories.find((current) => current.scope === expectedScope) ??
      null;

    await createCalendarItemForUser(user.id, {
      title: cleanText(action.title, "New reminder", 100),
      description: cleanOptionalText(action.description, 500) || null,
      itemType,
      category,
      categoryId: selectedCategory?.id ?? null,
      scheduledDate,
    });
    revalidatePath("/calendar");
    return {
      content: `Done. I added "${cleanText(action.title, "New reminder", 100)}" to your calendar for ${scheduledDate}.`,
      actionResult: { label: "Open Calendar", href: "/calendar" },
    };
  }

  if (action.type === "create_note") {
    const title = cleanText(action.title, "AI note", 120);
    const plainText = cleanText(action.content, "", 20000);
    const noteId = await createNoteForUser(user.id, plainTextToNoteContent(plainText));
    await updateNoteForUser(user.id, noteId, {
      title,
      content: plainTextToNoteContent(plainText),
      plainText,
      wordCount: wordCount(plainText),
    });
    revalidatePath("/notes");
    return {
      content: `Done. I created the note "${title}".`,
      actionResult: { label: "Open Notes", href: "/notes" },
    };
  }

  if (action.type === "create_whiteboard_prompt") {
    const name = cleanText(action.name, "AI whiteboard", 100);
    await createWhiteboardForUser(user.id, {
      name,
      color: action.color && whiteboardColors.has(action.color) ? action.color : "teal",
    });
    revalidatePath("/whiteboard");
    return {
      content: `Done. I created "${name}". Diagram prompt to use: ${cleanText(action.prompt, "Sketch the idea as a flowchart.", 1200)}`,
      actionResult: { label: "Open Whiteboard", href: "/whiteboard" },
    };
  }

  if (action.type === "generate_template_app") {
    const { appId, appJson } = await generateTemplateApp(cleanText(action.prompt, "Productivity tracker", 2500));
    return {
      content: `Done. I generated "${appJson.appName}" in AI Template Builder.`,
      actionResult: { label: "Open generated app", href: `/ai-template-builder/${appId}` },
    };
  }

  if (action.type === "update_settings") {
    const patch = sanitizeSettingsPatch(action.patch);
    if (!Object.keys(patch).length) {
      return { content: "I could not find a supported settings change in that request." };
    }
    await updateSettingsForUser(user.id, patch);
    revalidatePath("/settings");
    return {
      content: `Done. I updated your settings: ${cleanText(action.summary, "settings updated", 240)}.`,
      actionResult: { label: "Open Settings", href: "/settings" },
    };
  }

  return { content: "I could not complete that action yet." };
}

export async function sendAssistantMessage(messages: AssistantChatMessage[], pendingAction?: AssistantAction | null): Promise<AssistantResponse> {
  const user = await requireCurrentDbUser();
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";

  if (pendingAction && isConfirmation(latestUserMessage)) {
    return executeAction(pendingAction);
  }

  const aiSettings = await getAiSettingsForUser(user);
  if (!aiSettings.aiAssistant) {
    throw new Error("AI Assistant is disabled in Settings.");
  }
  try {
    assertConfigured("OPENAI_API_KEY");
  } catch (caughtError) {
    return {
      content: caughtError instanceof Error ? caughtError.message : "OPENAI_API_KEY is not configured.",
    };
  }

  const apiKey = configuredValue("OPENAI_API_KEY");

  const [{ boards, columns }, categories] = await Promise.all([getKanbanData(user), listCategoriesForUser(user.id)]);
  const workspaceContext = {
    today: new Date().toISOString().slice(0, 10),
    boards: boards.map((board) => ({
      name: board.name,
      columns: columns.filter((column) => column.boardId === board.id).map((column) => column.name),
    })),
    categories: categories.map((category) => ({
      scope: category.scope,
      name: category.name,
      color: category.color,
    })),
  };

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: aiSettings.preferredModel || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "none" },
    instructions: `You are Flowbase AI Assistant, a cozy command center for the user's productivity app.
Default behavior: ${aiSettings.defaultBehavior}. Tone: ${aiSettings.tone}.
Return only JSON with keys: mode, message, action.
Modes:
- answer: answer normally or summarize/refine text in chat without writing data.
- clarify: ask one concise follow-up question when required details are missing.
- action: request one safe app action with validated fields.
- confirm: use only for settings updates; ask the user to confirm and include the action.
Never invent IDs. Use board names and column names from context. If a calendar request lacks a date, clarify. Convert relative dates using today's date from context. Use YYYY-MM-DD dates.
Supported action types and fields:
create_kanban_board { type, boardName, color }
add_kanban_task { type, title, description, boardName, columnName, dueDate, priority, labels, syncCalendar }
add_calendar_item { type, title, description, itemType, scheduledDate, category }
create_note { type, title, content }
create_whiteboard_prompt { type, name, prompt, color }
generate_template_app { type, prompt }
update_settings { type, patch, summary }
For "create a task for tomorrow" prefer add_calendar_item unless a Kanban board is named. For "add task to board" use add_kanban_task.`,
    input: [
      {
        role: "user",
        content: `Workspace context:\n${JSON.stringify(workspaceContext)}\n\nConversation:\n${messages.map((message) => `${message.role}: ${message.content}`).join("\n")}`,
      },
    ],
  });

  const modelResponse = parseJsonOutput(response.output_text);

  if ((modelResponse.mode === "confirm" || modelResponse.action?.type === "update_settings") && modelResponse.action) {
    return {
      content: modelResponse.message || "Please confirm this settings change before I save it.",
      pendingAction: modelResponse.action,
    };
  }

  if (modelResponse.mode === "action" && modelResponse.action) {
    return executeAction(modelResponse.action);
  }

  return {
    content: modelResponse.message,
  };
}
