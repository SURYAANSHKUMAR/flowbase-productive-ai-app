"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";

import type { AiTemplateAction, AiTemplateAppJson, AiTemplateComponent, AiTemplateField, AiTemplateSection } from "@/lib/ai-template-types";
import { requireCurrentDbUser } from "@/lib/current-user";
import { configuredValue } from "@/lib/env";
import {
  createAiGeneratedAppForUser,
  deleteAiGeneratedAppForUser,
  getAiSettingsForUser,
  setAiGeneratedAppSidebarForUser,
} from "@/lib/workspace-data";

const componentTypes = new Set<AiTemplateComponent["type"]>([
  "stats",
  "list",
  "table",
  "form",
  "progress",
  "checklist",
  "buttons",
  "tags",
  "chart-placeholder",
]);
const fieldTypes = new Set<AiTemplateField["type"]>(["text", "number", "date", "select", "checkbox", "textarea"]);
const actionStyles = new Set<NonNullable<AiTemplateAction["style"]>>(["primary", "secondary", "outline"]);

function text(value: unknown, fallback: string, maxLength = 120) {
  const next = typeof value === "string" ? value.trim() : "";
  return (next || fallback).slice(0, maxLength);
}

function color(value: unknown) {
  const next = typeof value === "string" ? value.trim() : "";
  return /^#[0-9A-Fa-f]{6}$/.test(next) ? next.toUpperCase() : "#14B8A6";
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function sanitizeField(value: unknown): AiTemplateField {
  const raw = record(value);
  const rawType = text(raw.type, "text", 24) as AiTemplateField["type"];
  return {
    label: text(raw.label, "Field", 64),
    type: fieldTypes.has(rawType) ? rawType : "text",
    placeholder: typeof raw.placeholder === "string" ? text(raw.placeholder, "", 80) : undefined,
    options: array(raw.options).map((option) => text(option, "Option", 40)).slice(0, 6),
  };
}

function sanitizeAction(value: unknown): AiTemplateAction {
  const raw = record(value);
  const rawStyle = text(raw.style, "outline", 24) as AiTemplateAction["style"];
  return {
    label: text(raw.label, "Action", 48),
    style: actionStyles.has(rawStyle ?? "outline") ? rawStyle : "outline",
  };
}

function sanitizeSampleItem(value: unknown): Record<string, unknown> {
  const raw = record(value);
  return Object.fromEntries(
    Object.entries(raw)
      .slice(0, 8)
      .map(([key, item]) => [text(key, "item", 32), typeof item === "number" || typeof item === "boolean" ? item : text(item, "", 80)])
  );
}

function sanitizeComponent(value: unknown, index: number): AiTemplateComponent {
  const raw = record(value);
  const rawType = text(raw.type, index % 2 === 0 ? "list" : "stats", 32) as AiTemplateComponent["type"];
  const type = componentTypes.has(rawType) ? rawType : "list";
  return {
    type,
    title: text(raw.title, `${type[0].toUpperCase()}${type.slice(1)}`, 80),
    description: typeof raw.description === "string" ? text(raw.description, "", 160) : undefined,
    fields: array(raw.fields).map(sanitizeField).slice(0, 8),
    actions: array(raw.actions).map(sanitizeAction).slice(0, 4),
    items: array(raw.items).map(sanitizeSampleItem).slice(0, 8),
  };
}

function sanitizeSection(value: unknown, index: number): AiTemplateSection {
  const raw = record(value);
  const components = array(raw.components).map(sanitizeComponent).slice(0, 4);
  return {
    title: text(raw.title, index === 0 ? "Overview" : "Workspace", 80),
    description: typeof raw.description === "string" ? text(raw.description, "", 180) : undefined,
    components: components.length ? components : [sanitizeComponent({ type: "list", title: "Starter list" }, 0)],
  };
}

function parseJsonOutput(output: string) {
  const trimmed = output.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI did not return valid JSON.");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

function sanitizeTemplateApp(value: unknown): AiTemplateAppJson {
  const raw = record(value);
  const sections = array(raw.sections).map(sanitizeSection).slice(0, 5);
  const components = array(raw.components).map(sanitizeComponent).slice(0, 8);
  const fields = array(raw.fields).map(sanitizeField).slice(0, 10);
  const actions = array(raw.actions).map(sanitizeAction).slice(0, 6);
  const sampleData = array(raw.sampleData).map(sanitizeSampleItem).slice(0, 8);

  return {
    appName: text(raw.appName, "Generated App", 72),
    description: text(raw.description, "A single-page workspace generated from your prompt.", 180),
    icon: text(raw.icon, "Sparkles", 32),
    color: color(raw.color),
    layout: "single-page",
    sections: sections.length ? sections : [sanitizeSection({ title: "Overview", components }, 0)],
    components,
    fields,
    actions,
    sampleData,
  };
}

export async function generateTemplateApp(prompt: string) {
  const user = await requireCurrentDbUser();
  const aiSettings = await getAiSettingsForUser(user);
  if (!aiSettings.aiTemplateBuilder) {
    throw new Error("AI Template Builder is disabled in Settings.");
  }
  const appIdea = prompt.trim();
  if (appIdea.length < 3) {
    throw new Error("Describe the mini app you want to build.");
  }
  const apiKey = configuredValue("OPENAI_API_KEY");

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: aiSettings.preferredModel || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "none" },
    instructions:
      `Generate one complete single-page productivity mini app as strict JSON only. Default behavior: ${aiSettings.defaultBehavior}. Tone: ${aiSettings.tone}. Do not include markdown or prose. Use only these component types: stats, list, table, form, progress, checklist, buttons, tags, chart-placeholder. Return keys: appName, description, icon, color, layout, sections, components, fields, actions, sampleData.`,
    input: [
      {
        role: "user",
        content: `App idea: ${appIdea}\nReturn a polished, useful mini app JSON. Use a valid Lucide icon name and a #RRGGBB color.`,
      },
    ],
  });

  const appJson = sanitizeTemplateApp(parseJsonOutput(response.output_text));
  const appId = await createAiGeneratedAppForUser(user.id, { appJson });

  revalidatePath("/ai-template-builder");
  revalidatePath(`/ai-template-builder/${appId}`);
  revalidatePath("/");
  return { appId, appJson };
}

export async function addGeneratedAppToSidebar(appId: number) {
  const user = await requireCurrentDbUser();
  await setAiGeneratedAppSidebarForUser(user.id, appId, true);
  revalidatePath("/ai-template-builder");
  revalidatePath(`/ai-template-builder/${appId}`);
  revalidatePath("/");
}

export async function removeGeneratedAppFromSidebar(appId: number) {
  const user = await requireCurrentDbUser();
  await setAiGeneratedAppSidebarForUser(user.id, appId, false);
  revalidatePath("/ai-template-builder");
  revalidatePath(`/ai-template-builder/${appId}`);
  revalidatePath("/");
}

export async function deleteGeneratedApp(appId: number) {
  const user = await requireCurrentDbUser();
  await deleteAiGeneratedAppForUser(user.id, appId);
  revalidatePath("/ai-template-builder");
  revalidatePath("/");
}
