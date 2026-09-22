"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";

import { requireCurrentDbUser } from "@/lib/current-user";
import { configuredValue } from "@/lib/env";
import {
  createNoteForUser,
  deleteNoteForUser,
  duplicateNoteForUser,
  renameNoteForUser,
  setNoteCategoryForUser,
  setNoteColorForUser,
  setNotePinForUser,
  setNoteTrashForUser,
  updateNoteForUser,
  getAiSettingsForUser,
} from "@/lib/workspace-data";

export type NoteColor = "amber" | "teal" | "sky" | "rose" | "emerald" | "violet" | "slate";
export type NoteContent = Record<string, unknown>;
export type RefineAction = "grammar" | "rephrase" | "shorter" | "simplify" | "tone";

type UpdateNoteInput = {
  title: string;
  content: NoteContent;
  plainText: string;
  wordCount: number;
};

const allowedColors = new Set<NoteColor>(["amber", "teal", "sky", "rose", "emerald", "violet", "slate"]);
const defaultNoteContent: NoteContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
};

function cleanTitle(value: string) {
  const title = value.trim();
  return (title || "Untitled note").slice(0, 120);
}

function cleanText(value: string) {
  return value.trim().slice(0, 20000);
}

function cleanWordCount(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.min(Math.round(value), 100000);
}

export async function createNote() {
  const user = await requireCurrentDbUser();
  const noteId = await createNoteForUser(user.id, defaultNoteContent);

  revalidatePath("/notes");
  return noteId;
}

export async function updateNote(noteId: number, input: UpdateNoteInput) {
  const user = await requireCurrentDbUser();
  await updateNoteForUser(user.id, noteId, {
    title: cleanTitle(input.title),
    content: input.content,
    plainText: cleanText(input.plainText),
    wordCount: cleanWordCount(input.wordCount),
  });

  revalidatePath("/notes");
}

export async function renameNote(noteId: number, title: string) {
  const user = await requireCurrentDbUser();
  await renameNoteForUser(user.id, noteId, cleanTitle(title));

  revalidatePath("/notes");
}

export async function duplicateNote(noteId: number) {
  const user = await requireCurrentDbUser();
  const noteIdCopy = await duplicateNoteForUser(user.id, noteId);

  revalidatePath("/notes");
  return noteIdCopy;
}

export async function toggleNotePin(noteId: number, isPinned: boolean) {
  const user = await requireCurrentDbUser();
  await setNotePinForUser(user.id, noteId, isPinned);

  revalidatePath("/notes");
}

export async function updateNoteColor(noteId: number, color: NoteColor) {
  const user = await requireCurrentDbUser();
  await setNoteColorForUser(user.id, noteId, allowedColors.has(color) ? color : "amber");

  revalidatePath("/notes");
}

export async function updateNoteCategory(noteId: number, categoryId: number) {
  const user = await requireCurrentDbUser();
  await setNoteCategoryForUser(user.id, noteId, categoryId);

  revalidatePath("/notes");
}

export async function moveNoteToTrash(noteId: number) {
  const user = await requireCurrentDbUser();
  await setNoteTrashForUser(user.id, noteId, true);

  revalidatePath("/notes");
}

export async function restoreNote(noteId: number) {
  const user = await requireCurrentDbUser();
  await setNoteTrashForUser(user.id, noteId, false);

  revalidatePath("/notes");
}

export async function permanentlyDeleteNote(noteId: number) {
  const user = await requireCurrentDbUser();
  await deleteNoteForUser(user.id, noteId);
  revalidatePath("/notes");
}

export async function refineSelectedText(action: RefineAction, selectedText: string, tone?: string) {
  const user = await requireCurrentDbUser();
  const aiSettings = await getAiSettingsForUser(user);

  if (!aiSettings.aiRefine) {
    throw new Error("AI Refine is disabled in Settings.");
  }

  const text = selectedText.trim();
  if (!text) {
    throw new Error("Select text to refine.");
  }

  const apiKey = configuredValue("OPENAI_API_KEY");

  const actionInstructions: Record<RefineAction, string> = {
    grammar: "Improve grammar and punctuation without changing meaning.",
    rephrase: "Rephrase the text while preserving the original meaning.",
    shorter: "Make the text shorter and more direct.",
    simplify: "Simplify the language for clearer everyday reading.",
    tone: `Change the tone to ${tone?.trim() || "warm and professional"} while preserving meaning.`,
  };

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: aiSettings.preferredModel || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "none" },
    instructions:
      `You refine selected note text. Default behavior: ${aiSettings.defaultBehavior}. Response tone: ${aiSettings.tone}. Return only the revised text. Do not add markdown fences, explanations, labels, or surrounding quotes.`,
    input: [
      {
        role: "user",
        content: `${actionInstructions[action]}\n\nSelected text:\n${text}`,
      },
    ],
  });

  const refinedText = response.output_text.trim();
  if (!refinedText) {
    throw new Error("AI returned an empty refinement.");
  }

  return refinedText;
}
