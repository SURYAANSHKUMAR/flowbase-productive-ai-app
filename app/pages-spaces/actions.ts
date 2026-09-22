"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentDbUser } from "@/lib/current-user";
import {
  type SpaceColor,
  type WorkspacePageTemplate,
  addSpaceMemberForUser,
  createPageForUser,
  createSpaceForUser,
  deletePageForUser,
  deleteSpaceForUser,
  duplicatePageForUser,
  duplicateSpaceForUser,
  getPageDetailForUser,
  setPageArchiveForUser,
  setPageFavoriteForUser,
  setSpaceArchiveForUser,
  setSpaceFavoriteForUser,
  updatePageForUser,
  updateSpaceForUser,
} from "@/lib/workspace-data";

const allowedColors = new Set<SpaceColor>(["violet", "indigo", "sky", "emerald", "amber", "rose", "slate"]);
const allowedTemplates = new Set<WorkspacePageTemplate>(["blank", "project-plan", "meeting-notes", "prd", "research-notes", "task-plan"]);

function cleanName(value: string, fallback: string) {
  const name = value.trim();
  return (name || fallback).slice(0, 120);
}

function cleanDescription(value: string) {
  return value.trim().slice(0, 500);
}

function numberValue(value: FormDataEntryValue | null, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} is invalid.`);
  }
  return parsed;
}

function templateLabel(template: WorkspacePageTemplate) {
  const labels: Record<WorkspacePageTemplate, string> = {
    blank: "Blank Page",
    "project-plan": "Project Plan",
    "meeting-notes": "Meeting Notes",
    prd: "PRD",
    "research-notes": "Research Notes",
    "task-plan": "Task Plan",
  };
  return labels[template];
}

export async function createSpace(formData: FormData) {
  const user = await requireCurrentDbUser();
  const color = String(formData.get("color") ?? "violet") as SpaceColor;
  const spaceId = await createSpaceForUser(user, {
    name: cleanName(String(formData.get("name") ?? ""), "Untitled space"),
    description: cleanDescription(String(formData.get("description") ?? "")),
    color: allowedColors.has(color) ? color : "violet",
  });

  revalidatePath("/pages-spaces");
  redirect(`/pages-spaces/${spaceId}`);
}

export async function createPage(formData: FormData) {
  const user = await requireCurrentDbUser();
  const spaceId = numberValue(formData.get("spaceId"), "Space");
  const template = String(formData.get("template") ?? "blank") as WorkspacePageTemplate;
  const pageId = await createPageForUser(user, {
    spaceId,
    name: cleanName(String(formData.get("name") ?? ""), "Untitled page"),
    template: allowedTemplates.has(template) ? template : "blank",
    description: cleanDescription(String(formData.get("description") ?? templateLabel(allowedTemplates.has(template) ? template : "blank"))),
  });

  revalidatePath("/pages-spaces");
  revalidatePath(`/pages-spaces/${spaceId}`);
  redirect(`/pages-spaces/${spaceId}/pages/${pageId}`);
}

export async function quickCreatePage(spaceId: number, name: string) {
  const user = await requireCurrentDbUser();
  const pageId = await createPageForUser(user, {
    spaceId,
    name: cleanName(name, "Untitled page"),
    template: "blank",
    description: "Blank Page",
  });

  revalidatePath("/pages-spaces");
  revalidatePath(`/pages-spaces/${spaceId}`);
  redirect(`/pages-spaces/${spaceId}/pages/${pageId}`);
}

export async function inviteSpaceMember(spaceId: number, email: string) {
  const user = await requireCurrentDbUser();
  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid email address.");
  }

  await addSpaceMemberForUser(user.id, spaceId, normalizedEmail);
  revalidatePath("/pages-spaces");
  revalidatePath(`/pages-spaces/${spaceId}`);
}

export async function exportPage(pageId: number, spaceId: number) {
  const user = await requireCurrentDbUser();
  const detail = await getPageDetailForUser(user.id, spaceId, pageId);

  return {
    exportedAt: new Date().toISOString(),
    page: detail.page,
  };
}

export async function renameSpace(spaceId: number, name: string) {
  const user = await requireCurrentDbUser();
  await updateSpaceForUser(user.id, spaceId, { name: cleanName(name, "Untitled space") });
  revalidatePath("/pages-spaces");
  revalidatePath(`/pages-spaces/${spaceId}`);
}

export async function updateSpaceColor(spaceId: number, color: SpaceColor) {
  const user = await requireCurrentDbUser();
  await updateSpaceForUser(user.id, spaceId, { color: allowedColors.has(color) ? color : "violet" });
  revalidatePath("/pages-spaces");
  revalidatePath(`/pages-spaces/${spaceId}`);
}

export async function toggleSpaceFavorite(spaceId: number, isFavorite: boolean) {
  const user = await requireCurrentDbUser();
  await setSpaceFavoriteForUser(user.id, spaceId, isFavorite);
  revalidatePath("/pages-spaces");
  revalidatePath(`/pages-spaces/${spaceId}`);
}

export async function archiveSpace(spaceId: number, isArchived = true) {
  const user = await requireCurrentDbUser();
  await setSpaceArchiveForUser(user.id, spaceId, isArchived);
  revalidatePath("/pages-spaces");
  revalidatePath(`/pages-spaces/${spaceId}`);
}

export async function duplicateSpace(spaceId: number) {
  const user = await requireCurrentDbUser();
  const copyId = await duplicateSpaceForUser(user.id, spaceId);
  revalidatePath("/pages-spaces");
  redirect(`/pages-spaces/${copyId}`);
}

export async function deleteSpace(spaceId: number) {
  const user = await requireCurrentDbUser();
  await deleteSpaceForUser(user.id, spaceId);
  revalidatePath("/pages-spaces");
  redirect("/pages-spaces");
}

export async function renamePage(pageId: number, name: string, spaceId: number) {
  const user = await requireCurrentDbUser();
  await updatePageForUser(user.id, pageId, { name: cleanName(name, "Untitled page") });
  revalidatePath(`/pages-spaces/${spaceId}`);
  revalidatePath(`/pages-spaces/${spaceId}/pages/${pageId}`);
}

export async function movePage(pageId: number, nextSpaceId: number, currentSpaceId: number) {
  const user = await requireCurrentDbUser();
  await updatePageForUser(user.id, pageId, { spaceId: nextSpaceId });
  revalidatePath(`/pages-spaces/${currentSpaceId}`);
  revalidatePath(`/pages-spaces/${nextSpaceId}`);
  redirect(`/pages-spaces/${nextSpaceId}/pages/${pageId}`);
}

export async function togglePageFavorite(pageId: number, spaceId: number, isFavorite: boolean) {
  const user = await requireCurrentDbUser();
  await setPageFavoriteForUser(user.id, pageId, isFavorite);
  revalidatePath(`/pages-spaces/${spaceId}`);
  revalidatePath(`/pages-spaces/${spaceId}/pages/${pageId}`);
}

export async function archivePage(pageId: number, spaceId: number, isArchived = true) {
  const user = await requireCurrentDbUser();
  await setPageArchiveForUser(user.id, pageId, isArchived);
  revalidatePath(`/pages-spaces/${spaceId}`);
  revalidatePath(`/pages-spaces/${spaceId}/pages/${pageId}`);
}

export async function duplicatePage(pageId: number, spaceId: number) {
  const user = await requireCurrentDbUser();
  const copyId = await duplicatePageForUser(user.id, pageId);
  revalidatePath(`/pages-spaces/${spaceId}`);
  redirect(`/pages-spaces/${spaceId}/pages/${copyId}`);
}

export async function deletePage(pageId: number, spaceId: number) {
  const user = await requireCurrentDbUser();
  await deletePageForUser(user.id, pageId);
  revalidatePath(`/pages-spaces/${spaceId}`);
  redirect(`/pages-spaces/${spaceId}`);
}
