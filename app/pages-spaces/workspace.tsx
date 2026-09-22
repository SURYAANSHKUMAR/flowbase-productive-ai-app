"use client";

import {
  Archive,
  ArrowLeft,
  Copy,
  Download,
  FileText,
  Folder,
  Grid2X2,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Star,
  Trash2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import {
  archivePage,
  archiveSpace,
  createPage,
  createSpace,
  deletePage,
  deleteSpace,
  duplicatePage,
  duplicateSpace,
  exportPage,
  inviteSpaceMember,
  movePage,
  quickCreatePage,
  renamePage,
  renameSpace,
  togglePageFavorite,
  toggleSpaceFavorite,
  updateSpaceColor,
} from "@/app/pages-spaces/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { SpaceColor, WorkspacePageTemplate } from "@/lib/workspace-data";

export type SpaceView = {
  id: number;
  name: string;
  description: string;
  color: string;
  isFavorite: boolean;
  isArchived: boolean;
  members: { initials: string; name: string; color: string }[];
  pageCount: number;
  lastOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PageView = {
  id: number;
  spaceId: number;
  name: string;
  template: WorkspacePageTemplate;
  description: string;
  isFavorite: boolean;
  isArchived: boolean;
  commentsCount: number;
  linkedTasksCount: number;
  lastEditedBy: string;
  lastOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PageDetailView = PageView & { space: Omit<SpaceView, "pageCount"> };

const colors: { value: SpaceColor; label: string; icon: string; soft: string; border: string }[] = [
  { value: "violet", label: "Violet", icon: "bg-violet-500", soft: "bg-violet-50 text-violet-700", border: "border-violet-200" },
  { value: "indigo", label: "Indigo", icon: "bg-indigo-500", soft: "bg-indigo-50 text-indigo-700", border: "border-indigo-200" },
  { value: "sky", label: "Sky", icon: "bg-sky-500", soft: "bg-sky-50 text-sky-700", border: "border-sky-200" },
  { value: "emerald", label: "Emerald", icon: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-700", border: "border-emerald-200" },
  { value: "amber", label: "Amber", icon: "bg-amber-500", soft: "bg-amber-50 text-amber-700", border: "border-amber-200" },
  { value: "rose", label: "Rose", icon: "bg-rose-500", soft: "bg-rose-50 text-rose-700", border: "border-rose-200" },
  { value: "slate", label: "Slate", icon: "bg-slate-500", soft: "bg-slate-100 text-slate-700", border: "border-slate-200" },
];

const templates: { value: WorkspacePageTemplate; label: string }[] = [
  { value: "blank", label: "Blank Page" },
  { value: "project-plan", label: "Project Plan" },
  { value: "meeting-notes", label: "Meeting Notes" },
  { value: "prd", label: "PRD" },
  { value: "research-notes", label: "Research Notes" },
  { value: "task-plan", label: "Task Plan" },
];

const filters = ["All Spaces", "Favorites", "Recently Opened", "Archived"] as const;

function colorFor(value: string) {
  return colors.find((color) => color.value === value) ?? colors[0];
}

function templateLabel(value: WorkspacePageTemplate) {
  return templates.find((template) => template.value === value)?.label ?? "Blank Page";
}

function formatTime(value: string | null) {
  if (!value) return "Never opened";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < day * 2) return "yesterday";
  if (diff < day * 7) return `${Math.floor(diff / day)} days ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function promptText(label: string, current: string) {
  const next = window.prompt(label, current);
  return next?.trim() ? next.trim() : null;
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function HeaderButton({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title: string }) {
  return (
    <button
      className="inline-flex h-9 items-center justify-center rounded-lg border border-border/75 bg-white px-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-violet-50"
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function CreateSpaceDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2 rounded-lg bg-violet-600 text-white shadow-sm shadow-violet-900/10 hover:bg-violet-700">
          <Plus className="h-4 w-4" />
          New Space
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Space</DialogTitle>
          <DialogDescription>Set up a top-level workspace folder for related pages.</DialogDescription>
        </DialogHeader>
        <form action={createSpace} className="space-y-4">
          <label className="block text-sm font-semibold text-foreground">
            Space Name
            <input name="name" required className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-violet-200" />
          </label>
          <label className="block text-sm font-semibold text-foreground">
            Description
            <textarea name="description" className="mt-2 min-h-24 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-200" />
          </label>
          <div>
            <p className="text-sm font-semibold text-foreground">Color</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {colors.map((color, index) => (
                <label key={color.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/75 px-2 py-2 text-sm">
                  <input defaultChecked={index === 0} name="color" type="radio" value={color.value} />
                  <span className={cn("h-3 w-3 rounded-full", color.icon)} />
                  {color.label}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button className="rounded-lg bg-violet-600 hover:bg-violet-700" type="submit">Create Space</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreatePageDialog({ spaces, selectedSpaceId }: { spaces: SpaceView[]; selectedSpaceId?: number }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 rounded-lg bg-white">
          <FileText className="h-4 w-4" />
          New Page
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Page</DialogTitle>
          <DialogDescription>Add a document to one of your spaces.</DialogDescription>
        </DialogHeader>
        <form action={createPage} className="space-y-4">
          <label className="block text-sm font-semibold text-foreground">
            Page Name
            <input name="name" required className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-violet-200" />
          </label>
          <label className="block text-sm font-semibold text-foreground">
            Add to Space
            <select
              className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-violet-200"
              defaultValue={selectedSpaceId ?? spaces[0]?.id ?? ""}
              disabled={!spaces.length}
              name="spaceId"
              required
            >
              {!spaces.length && <option value="">Create a space first</option>}
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>{space.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-foreground">
            Template
            <select className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-violet-200" name="template">
              {templates.map((template) => (
                <option key={template.value} value={template.value}>{template.label}</option>
              ))}
            </select>
          </label>
          <DialogFooter>
            <Button className="rounded-lg bg-violet-600 hover:bg-violet-700" disabled={!spaces.length} type="submit">Create Page</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoreMenu({ children }: { children: React.ReactNode }) {
  return (
    <details className="relative">
      <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-muted-foreground hover:bg-violet-50 hover:text-foreground">
        <MoreHorizontal className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-border/75 bg-white p-1.5 shadow-xl shadow-slate-900/10">
        {children}
      </div>
    </details>
  );
}

function MenuButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function SpaceActions({ space }: { space: SpaceView }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <MoreMenu>
      <MenuButton onClick={() => {
        const next = promptText("Rename space", space.name);
        if (next) startTransition(() => void renameSpace(space.id, next));
      }}>
        <Pencil className="h-4 w-4" /> Rename Space
      </MenuButton>
      {colors.map((color) => (
        <MenuButton key={color.value} onClick={() => startTransition(() => void updateSpaceColor(space.id, color.value))}>
          <span className={cn("h-3 w-3 rounded-full", color.icon)} /> Change Color: {color.label}
        </MenuButton>
      ))}
      <MenuButton disabled={pending} onClick={() => {
        const next = promptText("New page name", "Untitled page");
        if (next) startTransition(() => void quickCreatePage(space.id, next));
      }}>
        <FileText className="h-4 w-4" /> Add Page
      </MenuButton>
      <MenuButton disabled={pending} onClick={() => {
        const email = promptText("Invite collaborator by email", "");
        if (email) startTransition(() => void inviteSpaceMember(space.id, email));
      }}>
        <UserPlus className="h-4 w-4" /> Invite Collaborator
      </MenuButton>
      <MenuButton disabled={pending} onClick={() => startTransition(() => void duplicateSpace(space.id))}><Copy className="h-4 w-4" /> Duplicate</MenuButton>
      <MenuButton disabled={pending} onClick={() => startTransition(() => void archiveSpace(space.id, !space.isArchived))}><Archive className="h-4 w-4" /> {space.isArchived ? "Restore" : "Archive"}</MenuButton>
      <MenuButton disabled={pending} onClick={() => window.confirm("Delete this space and its pages?") && startTransition(() => void deleteSpace(space.id))}>
        <Trash2 className="h-4 w-4 text-rose-500" /> Delete
      </MenuButton>
    </MoreMenu>
  );
}

function PageActions({ page, spaces }: { page: PageView; spaces: SpaceView[] }) {
  const [pending, startTransition] = React.useTransition();
  async function sharePage() {
    await navigator.clipboard.writeText(`${window.location.origin}/pages-spaces/${page.spaceId}/pages/${page.id}`);
  }

  async function downloadPage() {
    const payload = await exportPage(page.id, page.spaceId);
    downloadJson(`flowbase-page-${page.id}.json`, payload);
  }

  return (
    <MoreMenu>
      <MenuButton onClick={() => {
        const next = promptText("Rename page", page.name);
        if (next) startTransition(() => void renamePage(page.id, next, page.spaceId));
      }}>
        <Pencil className="h-4 w-4" /> Rename
      </MenuButton>
      {spaces.filter((space) => space.id !== page.spaceId).map((space) => (
        <MenuButton key={space.id} onClick={() => startTransition(() => void movePage(page.id, space.id, page.spaceId))}>
          <Folder className="h-4 w-4" /> Move to {space.name}
        </MenuButton>
      ))}
      <MenuButton disabled={pending} onClick={() => startTransition(() => void duplicatePage(page.id, page.spaceId))}><Copy className="h-4 w-4" /> Duplicate</MenuButton>
      <MenuButton disabled={pending} onClick={() => startTransition(() => void togglePageFavorite(page.id, page.spaceId, !page.isFavorite))}><Star className="h-4 w-4" /> Favorite</MenuButton>
      <MenuButton disabled={pending} onClick={() => startTransition(() => void sharePage())}><Share2 className="h-4 w-4" /> Copy Share Link</MenuButton>
      <MenuButton disabled={pending} onClick={() => startTransition(() => void downloadPage())}><Download className="h-4 w-4" /> Export JSON</MenuButton>
      <MenuButton disabled={pending} onClick={() => startTransition(() => void archivePage(page.id, page.spaceId, !page.isArchived))}><Archive className="h-4 w-4" /> {page.isArchived ? "Restore" : "Archive"}</MenuButton>
      <MenuButton disabled={pending} onClick={() => window.confirm("Delete this page?") && startTransition(() => void deletePage(page.id, page.spaceId))}>
        <Trash2 className="h-4 w-4 text-rose-500" /> Delete
      </MenuButton>
    </MoreMenu>
  );
}

export function AllSpacesWorkspace({ spaces }: { spaces: SpaceView[] }) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<(typeof filters)[number]>("All Spaces");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [sort, setSort] = React.useState("recent");
  const [pending, startTransition] = React.useTransition();

  const visibleSpaces = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return spaces
      .filter((space) => {
        if (filter === "Favorites") return space.isFavorite;
        if (filter === "Archived") return space.isArchived;
        if (filter === "Recently Opened") return Boolean(space.lastOpenedAt);
        return !space.isArchived;
      })
      .filter((space) => `${space.name} ${space.description}`.toLowerCase().includes(normalized))
      .sort((first, second) => {
        if (sort === "name") return first.name.localeCompare(second.name);
        if (sort === "pages") return second.pageCount - first.pageCount;
        if (sort === "favorites") return Number(second.isFavorite) - Number(first.isFavorite);
        return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
      });
  }, [filter, query, sort, spaces]);

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-white/55">
      <header className="border-b border-border/75 bg-white/80 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">All Spaces</h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">{spaces.length} {spaces.length === 1 ? "space" : "spaces"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CreatePageDialog spaces={spaces.filter((space) => !space.isArchived)} />
            <CreateSpaceDialog />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-lg border border-input bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-violet-200"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search spaces or pages..."
              value={query}
            />
          </label>
          <select className="h-10 rounded-lg border border-input bg-white px-3 text-sm" onChange={(event) => setSort(event.target.value)} value={sort}>
            <option value="recent">Recently Updated</option>
            <option value="name">Name</option>
            <option value="pages">Most Pages</option>
            <option value="favorites">Favorites</option>
          </select>
          <div className="flex rounded-lg border border-border/75 bg-white p-1">
            <HeaderButton title="Grid view" onClick={() => setView("grid")}><Grid2X2 className={cn("h-4 w-4", view === "grid" && "text-violet-600")} /></HeaderButton>
            <HeaderButton title="List view" onClick={() => setView("list")}><List className={cn("h-4 w-4", view === "list" && "text-violet-600")} /></HeaderButton>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground transition", filter === item ? "bg-violet-100 text-violet-700" : "bg-white hover:bg-violet-50")}
              onClick={() => setFilter(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 px-6 py-6">
        {!visibleSpaces.length ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-violet-200 bg-white/85 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <Folder className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">No spaces yet</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Create your first space, then add pages to organize docs, plans, notes, and references.</p>
            <div className="mt-5"><CreateSpaceDialog /></div>
          </div>
        ) : (
          <div className={cn(view === "grid" ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "space-y-3")}>
            {visibleSpaces.map((space) => {
              const color = colorFor(space.color);
              return (
                <article key={space.id} className={cn("rounded-lg border bg-white p-4 shadow-sm shadow-slate-900/[0.03] transition hover:-translate-y-0.5 hover:shadow-md", color.border, view === "list" && "flex items-center gap-4")}>
                  <Link className="block min-w-0 flex-1" href={`/pages-spaces/${space.id}`}>
                    <div className="flex items-start gap-3">
                      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white", color.icon)}>
                        <Folder className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-base font-semibold text-foreground">{space.name}</h2>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{space.description || "No description yet."}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                      <div className="flex -space-x-2">
                        {space.members.slice(0, 3).map((member) => (
                          <span key={`${space.id}-${member.initials}`} className={cn("flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white", member.color)} title={member.name}>
                            {member.initials}
                          </span>
                        ))}
                      </div>
                      <span>{space.pageCount} {space.pageCount === 1 ? "Page" : "Pages"}</span>
                      <span>Updated {formatTime(space.updatedAt)}</span>
                    </div>
                  </Link>
                  <div className="mt-4 flex items-center justify-between">
                    <button
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-violet-50 hover:text-violet-600"
                      disabled={pending}
                      onClick={() => startTransition(() => void toggleSpaceFavorite(space.id, !space.isFavorite))}
                      type="button"
                    >
                      <Star className={cn("h-4 w-4", space.isFavorite && "fill-violet-500 text-violet-500")} />
                    </button>
                    <SpaceActions space={space} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function SpaceWorkspace({ space, pages, spaces }: { space: SpaceView; pages: PageView[]; spaces: SpaceView[] }) {
  const visiblePages = pages.filter((page) => !page.isArchived);
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-white/55">
      <header className="border-b border-border/75 bg-white/80 px-6 py-5 backdrop-blur">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-violet-700" href="/pages-spaces">
          <ArrowLeft className="h-4 w-4" /> All Spaces
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">{space.name}</h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">{visiblePages.length} {visiblePages.length === 1 ? "page" : "pages"}</p>
          </div>
          <div className="flex items-center gap-2">
            <CreatePageDialog selectedSpaceId={space.id} spaces={spaces.filter((item) => !item.isArchived)} />
            <SpaceActions space={space} />
          </div>
        </div>
      </header>
      <div className="px-6 py-6">
        {!visiblePages.length ? (
          <div className="flex min-h-[340px] flex-col items-center justify-center rounded-lg border border-dashed border-violet-200 bg-white/85 p-8 text-center">
            <FileText className="h-10 w-10 text-violet-500" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">No pages in this space</h2>
            <p className="mt-2 text-sm text-muted-foreground">Add a page to start organizing this space.</p>
            <div className="mt-5"><CreatePageDialog selectedSpaceId={space.id} spaces={spaces.filter((item) => !item.isArchived)} /></div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/75 bg-white shadow-sm shadow-slate-900/[0.03]">
            <div className="grid grid-cols-[1.6fr_1fr_1fr_0.8fr_0.5fr] gap-3 border-b border-border/75 bg-violet-50/55 px-4 py-3 text-xs font-bold uppercase text-muted-foreground">
              <span>Page Name</span><span>Type/Template</span><span>Last updated</span><span>Updated by</span><span>Favorite</span>
            </div>
            {visiblePages.map((page) => (
              <div key={page.id} className="grid grid-cols-[1.6fr_1fr_1fr_0.8fr_0.5fr] items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
                <Link className="flex min-w-0 items-center gap-3 font-semibold text-foreground hover:text-violet-700" href={`/pages-spaces/${space.id}/pages/${page.id}`}>
                  <FileText className="h-4 w-4 shrink-0 text-violet-500" />
                  <span className="truncate">{page.name}</span>
                </Link>
                <span className="w-fit rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">{templateLabel(page.template)}</span>
                <span className="text-sm text-muted-foreground">{formatTime(page.updatedAt)}</span>
                <span className="text-sm font-semibold text-foreground">{page.lastEditedBy || "You"}</span>
                <div className="flex items-center justify-between">
                  <Star className={cn("h-4 w-4 text-muted-foreground", page.isFavorite && "fill-violet-500 text-violet-500")} />
                  <PageActions page={page} spaces={spaces} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function PageDetailWorkspace({ page, spaces }: { page: PageDetailView; spaces: SpaceView[] }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-white/55">
      <header className="border-b border-border/75 bg-white/80 px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Link className="hover:text-violet-700" href="/pages-spaces">All Spaces</Link>
          <span>&gt;</span>
          <Link className="hover:text-violet-700" href={`/pages-spaces/${page.space.id}`}>{page.space.name}</Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">{page.name}</h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">Updated {formatTime(page.updatedAt)}</p>
          </div>
          <PageActions page={page} spaces={spaces} />
        </div>
      </header>
      <div className="px-6 py-6">
        <article className="max-w-3xl rounded-lg border border-border/75 bg-white p-5 shadow-sm shadow-slate-900/[0.03]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">{page.name}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">{templateLabel(page.template)}</span>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{page.space.name}</span>
                </div>
              </div>
            </div>
            <Star className={cn("h-5 w-5 text-muted-foreground", page.isFavorite && "fill-violet-500 text-violet-500")} />
          </div>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">{page.description || "No description yet."}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoTile label="Comments" value={String(page.commentsCount)} />
            <InfoTile label="Linked tasks" value={String(page.linkedTasksCount)} />
            <InfoTile label="Last edited by" value={page.lastEditedBy || "You"} />
            <InfoTile label="Last opened" value={formatTime(page.lastOpenedAt)} />
          </div>
        </article>
      </div>
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/75 bg-violet-50/35 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
