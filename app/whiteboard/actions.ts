"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";

import { requireCurrentDbUser } from "@/lib/current-user";
import { configuredValue } from "@/lib/env";
import {
  type WhiteboardScene,
  createWhiteboardForUser,
  deleteWhiteboardForUser,
  getAiSettingsForUser,
  renameWhiteboardForUser,
  updateWhiteboardSceneForUser,
} from "@/lib/workspace-data";

export type WhiteboardColor = "teal" | "sky" | "rose" | "amber" | "emerald" | "violet" | "slate";
export type DiagramNodeKind = "rectangle" | "diamond" | "ellipse";
export type DiagramSpec = {
  title: string;
  layout: "flowchart" | "mindmap" | "architecture" | "journey" | "process";
  nodes: {
    id: string;
    label: string;
    kind: DiagramNodeKind;
    lane?: string;
  }[];
  edges: {
    from: string;
    to: string;
    label?: string;
  }[];
};

const allowedColors = new Set<WhiteboardColor>(["teal", "sky", "rose", "amber", "emerald", "violet", "slate"]);
const allowedLayouts = new Set<DiagramSpec["layout"]>(["flowchart", "mindmap", "architecture", "journey", "process"]);
const allowedKinds = new Set<DiagramNodeKind>(["rectangle", "diamond", "ellipse"]);

function cleanName(value: string) {
  const name = value.trim();
  return (name || "Untitled whiteboard").slice(0, 100);
}

function cleanPrompt(value: string) {
  const prompt = value.trim();
  if (!prompt) {
    throw new Error("Describe the diagram you want to generate.");
  }

  return prompt.slice(0, 2500);
}

function cleanScene(scene: WhiteboardScene): WhiteboardScene {
  return {
    elements: Array.isArray(scene.elements) ? scene.elements.slice(0, 3000) : [],
    appState: scene.appState && typeof scene.appState === "object" ? scene.appState : {},
    files: scene.files && typeof scene.files === "object" ? scene.files : {},
  };
}

function cleanDiagramSpec(value: unknown): DiagramSpec {
  if (!value || typeof value !== "object") {
    throw new Error("AI returned an invalid diagram.");
  }

  const record = value as Record<string, unknown>;
  const nodes = Array.isArray(record.nodes) ? record.nodes : [];
  const edges = Array.isArray(record.edges) ? record.edges : [];
  const cleanNodes = nodes
    .map((node, index) => {
      const current = node as Record<string, unknown>;
      const id = String(current.id || `node-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || `node-${index + 1}`;
      const label = String(current.label || `Step ${index + 1}`).trim().slice(0, 90);
      const kind = allowedKinds.has(current.kind as DiagramNodeKind) ? (current.kind as DiagramNodeKind) : "rectangle";
      const lane = typeof current.lane === "string" ? current.lane.trim().slice(0, 40) : undefined;
      return { id, label, kind, lane };
    })
    .filter((node) => node.label)
    .slice(0, 18);

  const nodeIds = new Set(cleanNodes.map((node) => node.id));
  const cleanEdges = edges
    .map((edge) => {
      const current = edge as Record<string, unknown>;
      return {
        from: String(current.from || ""),
        to: String(current.to || ""),
        label: typeof current.label === "string" ? current.label.trim().slice(0, 42) : undefined,
      };
    })
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to) && edge.from !== edge.to)
    .slice(0, 24);

  if (cleanNodes.length === 0) {
    throw new Error("AI did not return any diagram nodes.");
  }

  return {
    title: String(record.title || "Generated diagram").trim().slice(0, 90),
    layout: allowedLayouts.has(record.layout as DiagramSpec["layout"]) ? (record.layout as DiagramSpec["layout"]) : "flowchart",
    nodes: cleanNodes,
    edges: cleanEdges,
  };
}

function revalidateWhiteboard() {
  revalidatePath("/whiteboard");
}

export async function createWhiteboard(name = "Untitled whiteboard", color: WhiteboardColor = "teal") {
  const user = await requireCurrentDbUser();
  const whiteboardId = await createWhiteboardForUser(user.id, {
    name: cleanName(name),
    color: allowedColors.has(color) ? color : "teal",
  });

  revalidateWhiteboard();
  return whiteboardId;
}

export async function renameWhiteboard(whiteboardId: number, name: string) {
  const user = await requireCurrentDbUser();
  await renameWhiteboardForUser(user.id, whiteboardId, cleanName(name));
  revalidateWhiteboard();
}

export async function saveWhiteboard(whiteboardId: number, scene: WhiteboardScene) {
  const user = await requireCurrentDbUser();
  await updateWhiteboardSceneForUser(user.id, whiteboardId, cleanScene(scene));
  revalidateWhiteboard();
}

export async function deleteWhiteboard(whiteboardId: number) {
  const user = await requireCurrentDbUser();
  await deleteWhiteboardForUser(user.id, whiteboardId);
  revalidateWhiteboard();
}

export async function generateDiagram(promptValue: string): Promise<DiagramSpec> {
  const user = await requireCurrentDbUser();
  const aiSettings = await getAiSettingsForUser(user);
  if (!aiSettings.aiDiagram) {
    throw new Error("AI Diagram is disabled in Settings.");
  }
  const prompt = cleanPrompt(promptValue);

  const apiKey = configuredValue("OPENAI_API_KEY");

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: aiSettings.preferredModel || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    reasoning: { effort: "none" },
    instructions:
      `Create a compact diagram specification for a whiteboard. Default behavior: ${aiSettings.defaultBehavior}. Tone: ${aiSettings.tone}. Return only valid JSON with title, layout, nodes, and edges. Layout must be one of flowchart, mindmap, architecture, journey, process. Node kind must be rectangle, diamond, or ellipse. Keep labels short. Do not return markdown.`,
    input: [
      {
        role: "user",
        content: `Prompt: ${prompt}\n\nReturn JSON shaped like {"title":"...","layout":"flowchart","nodes":[{"id":"n1","label":"Start","kind":"ellipse"}],"edges":[{"from":"n1","to":"n2","label":"optional"}]}.`,
      },
    ],
  });

  const raw = response.output_text.trim();
  if (!raw) {
    throw new Error("AI returned an empty diagram.");
  }

  try {
    return cleanDiagramSpec(JSON.parse(raw));
  } catch {
    throw new Error("AI returned a diagram format this whiteboard could not read.");
  }
}
