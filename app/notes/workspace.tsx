"use client";

import CharacterCount from "@tiptap/extension-character-count";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import type { Editor, JSONContent } from "@tiptap/core";
import {
  Bold,
  Code,
  FileText,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  MoreHorizontal,
  Pilcrow,
  Pin,
  Plus,
  Quote,
  Redo2,
  RotateCcw,
  Search,
  Sparkles,
  Strikethrough,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  type NoteColor,
  type NoteContent,
  type RefineAction,
  createNote,
  duplicateNote,
  moveNoteToTrash,
  permanentlyDeleteNote,
  refineSelectedText,
  renameNote,
  restoreNote,
  toggleNotePin,
  updateNote,
  updateNoteCategory,
} from "@/app/notes/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NoteView = {
  id: number;
  title: string;
  icon: string;
  color: string;
  categoryId: number | null;
  content: NoteContent;
  plainText: string;
  wordCount: number;
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NoteCategoryView = {
  id: number;
  name: string;
  color: string;
  icon: string;
};

type SaveStatus = "saved" | "saving" | "error";
type SlashItem = {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  keywords: string[];
  command: (editor: Editor, range: { from: number; to: number }) => void;
};

const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const noteColors: {
  value: NoteColor;
  label: string;
  dot: string;
  soft: string;
  border: string;
}[] = [
  { value: "amber", label: "Amber", dot: "bg-amber-500", soft: "bg-amber-50 text-amber-700", border: "border-amber-200" },
  { value: "teal", label: "Teal", dot: "bg-teal-500", soft: "bg-teal-50 text-teal-700", border: "border-teal-200" },
  { value: "sky", label: "Sky", dot: "bg-sky-500", soft: "bg-sky-50 text-sky-700", border: "border-sky-200" },
  { value: "rose", label: "Rose", dot: "bg-rose-500", soft: "bg-rose-50 text-rose-700", border: "border-rose-200" },
  { value: "emerald", label: "Emerald", dot: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-700", border: "border-emerald-200" },
  { value: "violet", label: "Violet", dot: "bg-violet-500", soft: "bg-violet-50 text-violet-700", border: "border-violet-200" },
  { value: "slate", label: "Slate", dot: "bg-slate-500", soft: "bg-slate-100 text-slate-700", border: "border-slate-200" },
];

const refineActions: { value: RefineAction; label: string; tone?: string }[] = [
  { value: "grammar", label: "Improve grammar" },
  { value: "rephrase", label: "Rephrase" },
  { value: "shorter", label: "Make shorter" },
  { value: "simplify", label: "Simplify language" },
  { value: "tone", label: "Change tone", tone: "calm, warm, and professional" },
];

const slashItems: SlashItem[] = [
  {
    label: "Text",
    description: "Plain paragraph",
    icon: Pilcrow,
    keywords: ["paragraph", "text"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    label: "Heading 1",
    description: "Large section heading",
    icon: Heading1,
    keywords: ["h1", "title"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    label: "Heading 2",
    description: "Medium section heading",
    icon: Heading2,
    keywords: ["h2", "subtitle"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    label: "Bulleted list",
    description: "Simple list",
    icon: List,
    keywords: ["bullet", "unordered"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    label: "Numbered list",
    description: "Ordered steps",
    icon: ListOrdered,
    keywords: ["number", "ordered"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    label: "Task list",
    description: "Checkbox list",
    icon: ListChecks,
    keywords: ["todo", "check"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    label: "Quote",
    description: "Callout quote",
    icon: Quote,
    keywords: ["blockquote", "callout"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    label: "Code block",
    description: "Monospace block",
    icon: Code,
    keywords: ["code"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    label: "Divider",
    description: "Horizontal rule",
    icon: MoreHorizontal,
    keywords: ["line", "rule", "hr"],
    command: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

function colorFor(value: string) {
  return noteColors.find((color) => color.value === value) ?? noteColors[0];
}

function categoryFor(note: NoteView, categories: NoteCategoryView[]) {
  return categories.find((category) => category.id === note.categoryId) ?? categories.find((category) => category.color === note.color) ?? null;
}

function wordsIn(value: string) {
  const matches = value.trim().match(/\S+/g);
  return matches?.length ?? 0;
}

function formatUpdated(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  return new Intl.DateTimeFormat("en", isToday ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric" }).format(date);
}

function contentFor(note: NoteView | null) {
  return (note?.content as JSONContent | undefined) ?? emptyDocument;
}

export function NotesWorkspace({ categories, notes }: { categories: NoteCategoryView[]; notes: NoteView[] }) {
  const router = useRouter();
  const [localNotes, setLocalNotes] = React.useState(notes);
  const [selectedNoteId, setSelectedNoteId] = React.useState<number | null>(notes.find((note) => !note.isDeleted)?.id ?? notes[0]?.id ?? null);
  const [search, setSearch] = React.useState("");
  const [titleDraft, setTitleDraft] = React.useState("");
  const [dirty, setDirty] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("saved");
  const [error, setError] = React.useState("");
  const [slashQuery, setSlashQuery] = React.useState("");
  const [slashRange, setSlashRange] = React.useState<{ from: number; to: number } | null>(null);
  const [slashPosition, setSlashPosition] = React.useState<{ top: number; left: number } | null>(null);
  const [aiMenuOpen, setAiMenuOpen] = React.useState(false);
  const [aiPending, setAiPending] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setLocalNotes(notes);
    setSelectedNoteId((current) => {
      if (current && notes.some((note) => note.id === current)) {
        return current;
      }

      return notes.find((note) => !note.isDeleted)?.id ?? notes[0]?.id ?? null;
    });
  }, [notes]);

  const selectedNote = localNotes.find((note) => note.id === selectedNoteId) ?? null;
  const selectedNoteRef = React.useRef<NoteView | null>(selectedNote);

  React.useEffect(() => {
    selectedNoteRef.current = selectedNote;
  }, [selectedNote]);
  const activeNotes = React.useMemo(
    () =>
      localNotes
        .filter((note) => !note.isDeleted)
        .filter((note) => {
          const query = search.trim().toLowerCase();
          if (!query) {
            return true;
          }

          return `${note.title} ${note.plainText}`.toLowerCase().includes(query);
        })
        .sort((first, second) => Number(second.isPinned) - Number(first.isPinned) || new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()),
    [localNotes, search]
  );
  const trashedNotes = React.useMemo(
    () => localNotes.filter((note) => note.isDeleted).sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()),
    [localNotes]
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          link: false,
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: {
            class: "text-teal-700 underline underline-offset-4",
          },
        }),
        TaskList.configure({
          HTMLAttributes: {
            class: "not-prose space-y-1",
          },
        }),
        TaskItem.configure({
          nested: true,
          HTMLAttributes: {
            class: "flex gap-2",
          },
        }),
        CharacterCount,
        Placeholder.configure({
          placeholder: "Press / for commands",
        }),
      ],
      content: contentFor(selectedNote),
      editorProps: {
        attributes: {
          class:
            "notes-editor min-h-[420px] w-full px-5 py-6 text-[15px] leading-7 text-foreground outline-none sm:px-9 lg:px-12",
        },
      },
      onUpdate: ({ editor: currentEditor }) => {
        setDirty(true);
        setError("");
        updateSlashMenu(currentEditor);
      },
      onSelectionUpdate: ({ editor: currentEditor }) => updateSlashMenu(currentEditor),
    },
    []
  );

  React.useEffect(() => {
    const currentNote = selectedNoteRef.current;

    setTitleDraft(currentNote?.title ?? "");
    setDirty(false);
    setSaveStatus("saved");
    setError("");
    setSlashRange(null);
    setSlashPosition(null);

    if (editor && currentNote) {
      editor.commands.setContent(contentFor(currentNote));
    }
  }, [editor, selectedNote?.id]);

  React.useEffect(() => {
    const noteId = selectedNote?.id;

    if (!dirty || !noteId || !editor) {
      return;
    }

    setSaveStatus("saving");
    const timeout = window.setTimeout(async () => {
      const plainText = editor.getText();
      const wordCount = wordsIn(plainText);
      const nextTitle = titleDraft.trim() || "Untitled note";
      const now = new Date().toISOString();

      setLocalNotes((current) =>
        current.map((note) =>
          note.id === noteId
            ? {
                ...note,
                title: nextTitle,
                content: editor.getJSON() as NoteContent,
                plainText,
                wordCount,
                updatedAt: now,
              }
            : note
        )
      );

      try {
        await updateNote(noteId, {
          title: nextTitle,
          content: editor.getJSON() as NoteContent,
          plainText,
          wordCount,
        });
        setSaveStatus("saved");
        setDirty(false);
      } catch (caughtError) {
        setSaveStatus("error");
        setError(caughtError instanceof Error ? caughtError.message : "Unable to save note.");
      }
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [dirty, editor, selectedNote?.id, titleDraft]);

  function updateSlashMenu(currentEditor: Editor) {
    const { state, view } = currentEditor;
    const { from, empty } = state.selection;

    if (!empty) {
      setSlashRange(null);
      setSlashPosition(null);
      return;
    }

    const blockStart = state.selection.$from.start();
    const textBefore = state.doc.textBetween(blockStart, from, "\n", "\n");
    const match = textBefore.match(/(?:^|\s)\/([A-Za-z]*)$/);

    if (!match) {
      setSlashRange(null);
      setSlashPosition(null);
      return;
    }

    const query = match[1] ?? "";
    const slashFrom = from - query.length - 1;
    const coords = view.coordsAtPos(from);

    setSlashQuery(query);
    setSlashRange({ from: slashFrom, to: from });
    setSlashPosition({
      top: coords.bottom + window.scrollY + 8,
      left: Math.min(coords.left + window.scrollX, window.innerWidth - 280),
    });
  }

  function refresh() {
    router.refresh();
  }

  function selectNote(noteId: number) {
    setSelectedNoteId(noteId);
  }

  function addNote() {
    startTransition(async () => {
      try {
        const noteId = await createNote();
        setSelectedNoteId(noteId);
        refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to create note.");
      }
    });
  }

  function runAction(action: () => Promise<number | void>, nextSelectedId?: number | null) {
    startTransition(async () => {
      try {
        const result = await action();
        if (typeof result === "number") {
          setSelectedNoteId(result);
        } else if (nextSelectedId !== undefined) {
          setSelectedNoteId(nextSelectedId);
        }
        refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to update note.");
      }
    });
  }

  function chooseCategory(noteId: number, category: NoteCategoryView) {
    setLocalNotes((current) =>
      current.map((note) =>
        note.id === noteId ? { ...note, categoryId: category.id, color: category.color, icon: category.icon, updatedAt: new Date().toISOString() } : note
      )
    );
    runAction(() => updateNoteCategory(noteId, category.id));
  }

  function togglePin(note: NoteView) {
    setLocalNotes((current) => current.map((currentNote) => (currentNote.id === note.id ? { ...currentNote, isPinned: !note.isPinned } : currentNote)));
    runAction(() => toggleNotePin(note.id, !note.isPinned));
  }

  function trashNote(noteId: number) {
    const nextNote = activeNotes.find((note) => note.id !== noteId)?.id ?? null;
    setLocalNotes((current) =>
      current.map((note) => (note.id === noteId ? { ...note, isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : note))
    );
    runAction(() => moveNoteToTrash(noteId), nextNote);
  }

  function restore(noteId: number) {
    runAction(() => restoreNote(noteId), noteId);
  }

  function deleteForever(noteId: number) {
    const nextNote = activeNotes.find((note) => note.id !== noteId)?.id ?? null;
    runAction(() => permanentlyDeleteNote(noteId), selectedNoteId === noteId ? nextNote : undefined);
  }

  function renameFromPanel(note: NoteView) {
    const nextTitle = window.prompt("Rename note", note.title);
    if (nextTitle === null) {
      return;
    }

    setLocalNotes((current) => current.map((currentNote) => (currentNote.id === note.id ? { ...currentNote, title: nextTitle.trim() || "Untitled note" } : currentNote)));
    runAction(() => renameNote(note.id, nextTitle));
  }

  function duplicate(noteId: number) {
    runAction(() => duplicateNote(noteId));
  }

  function runSlashCommand(item: SlashItem) {
    if (!editor || !slashRange) {
      return;
    }

    item.command(editor, slashRange);
    setSlashRange(null);
    setSlashPosition(null);
  }

  async function refineText(action: RefineAction, tone?: string) {
    if (!editor) {
      return;
    }

    const { from, to, empty } = editor.state.selection;
    if (empty) {
      return;
    }

    const selectedText = editor.state.doc.textBetween(from, to, " ");
    setAiPending(true);
    setError("");

    try {
      const refinedText = await refineSelectedText(action, selectedText, tone);
      editor.chain().focus().insertContentAt({ from, to }, refinedText).run();
      setDirty(true);
      setAiMenuOpen(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to refine selected text.");
    } finally {
      setAiPending(false);
    }
  }

  const filteredSlashItems = slashItems.filter((item) => {
    const query = slashQuery.toLowerCase();
    return !query || item.label.toLowerCase().includes(query) || item.keywords.some((keyword) => keyword.includes(query));
  });

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/75 bg-background/70 px-4 py-4 backdrop-blur sm:px-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Notes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">Writing space</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex h-9 items-center rounded-lg border px-3 text-sm font-semibold",
              saveStatus === "saved" && "border-teal-100 bg-teal-50 text-teal-700",
              saveStatus === "saving" && "border-amber-100 bg-amber-50 text-amber-700",
              saveStatus === "error" && "border-rose-100 bg-rose-50 text-rose-700"
            )}
          >
            {saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving..." : "Save failed"}
          </span>
          <Button className="h-9 rounded-lg gap-2" disabled={isPending} onClick={addNote}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Note
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-5 px-4 py-5 lg:grid-cols-[320px_minmax(0,1fr)] sm:px-6">
        <aside className="flex min-h-[360px] min-w-0 flex-col rounded-lg border border-border/75 bg-card/95 p-4 shadow-sm shadow-slate-900/[0.025]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">All notes</p>
              <h2 className="mt-1 text-base font-semibold text-card-foreground">{activeNotes.length} active pages</h2>
            </div>
            <Button className="h-8 w-8 rounded-lg" disabled={isPending} size="icon" variant="outline" onClick={addNote}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Create note</span>
            </Button>
          </div>

          <label className="mt-4 flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search notes"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {activeNotes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                Create a note to start writing, collecting ideas, and refining selected text.
              </div>
            ) : (
              activeNotes.map((note) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  active={note.id === selectedNoteId}
                  categories={categories}
                  onCategory={chooseCategory}
                  onDelete={trashNote}
                  onDuplicate={duplicate}
                  onPin={togglePin}
                  onRename={renameFromPanel}
                  onSelect={selectNote}
                />
              ))
            )}
          </div>

          <div className="mt-4 border-t border-border/75 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Trash
              </div>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">{trashedNotes.length}</span>
            </div>
            {trashedNotes.length > 0 && (
              <div className="mt-2 max-h-36 space-y-1 overflow-y-auto pr-1">
                {trashedNotes.map((note) => (
                  <div key={note.id} className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/80 p-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{note.title}</span>
                    <Button className="h-7 w-7 rounded-lg" size="icon" variant="ghost" onClick={() => restore(note.id)}>
                      <RotateCcw className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
                      <span className="sr-only">Restore note</span>
                    </Button>
                    <Button className="h-7 w-7 rounded-lg" size="icon" variant="ghost" onClick={() => deleteForever(note.id)}>
                      <X className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                      <span className="sr-only">Delete permanently</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-h-[620px] min-w-0 flex-col rounded-lg border border-border/75 bg-card/95 shadow-sm shadow-slate-900/[0.025]">
          {selectedNote && editor ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/75 px-4 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className={cn("h-9 w-9 shrink-0 rounded-lg border", colorFor(categoryFor(selectedNote, categories)?.color ?? selectedNote.color).soft, colorFor(categoryFor(selectedNote, categories)?.color ?? selectedNote.color).border)}>
                    <FileText className="m-2 h-4 w-4" aria-hidden="true" />
                  </span>
                  <input
                    className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-foreground outline-none placeholder:text-muted-foreground"
                    placeholder="Untitled note"
                    value={titleDraft}
                    onChange={(event) => {
                      setTitleDraft(event.target.value);
                      setDirty(true);
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <span>{editor.storage.characterCount?.words?.() ?? selectedNote.wordCount} words</span>
                  <span className="hidden sm:inline">Updated {formatUpdated(selectedNote.updatedAt)}</span>
                </div>
              </div>

              <EditorToolbar editor={editor} />

              {error && <p className="mx-4 mt-3 rounded-lg border border-destructive/20 bg-red-50 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}

              <div className="relative min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-card to-background/80">
                <EditorContent editor={editor} />
                {editor && (
                  <BubbleMenu
                    className="relative flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-lg shadow-slate-900/10"
                    editor={editor}
                  >
                    <BubbleButton active={editor.isActive("bold")} label="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>
                      <Bold className="h-3.5 w-3.5" aria-hidden="true" />
                    </BubbleButton>
                    <BubbleButton active={editor.isActive("italic")} label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>
                      <Italic className="h-3.5 w-3.5" aria-hidden="true" />
                    </BubbleButton>
                    <BubbleButton active={editor.isActive("strike")} label="Strike" onClick={() => editor.chain().focus().toggleStrike().run()}>
                      <Strikethrough className="h-3.5 w-3.5" aria-hidden="true" />
                    </BubbleButton>
                    <div className="relative">
                      <button
                        className={cn(
                          "flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold transition-colors hover:bg-accent",
                          aiMenuOpen && "bg-primary-soft text-primary"
                        )}
                        disabled={aiPending}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setAiMenuOpen((open) => !open);
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        {aiPending ? "Refining..." : "AI Refine"}
                      </button>
                      {aiMenuOpen && (
                        <div className="absolute left-0 top-10 z-50 w-48 rounded-lg border border-border bg-card p-1 shadow-xl shadow-slate-900/10">
                          {refineActions.map((action) => (
                            <button
                              key={action.label}
                              className="flex h-8 w-full items-center rounded-md px-2 text-left text-xs font-semibold text-foreground hover:bg-accent"
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                refineText(action.value, action.tone);
                              }}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </BubbleMenu>
                )}

                {slashPosition && slashRange && (
                  <div
                    className="fixed z-50 w-72 rounded-lg border border-border bg-card p-1 shadow-xl shadow-slate-900/10"
                    style={{ left: slashPosition.left, top: slashPosition.top }}
                  >
                    {filteredSlashItems.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No commands found</p>
                    ) : (
                      filteredSlashItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.label}
                            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              runSlashCommand(item);
                            }}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                              <Icon className="h-4 w-4" aria-hidden={true} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-foreground">{item.label}</span>
                              <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-h-[520px] flex-1 items-center justify-center p-6">
              <div className="max-w-sm text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-foreground">No note selected</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Create a new note or restore one from Trash to open the editor.</p>
                <Button className="mt-4 rounded-lg gap-2" onClick={addNote}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New Note
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function NoteListItem({
  active,
  categories,
  note,
  onCategory,
  onDelete,
  onDuplicate,
  onPin,
  onRename,
  onSelect,
}: {
  active: boolean;
  categories: NoteCategoryView[];
  note: NoteView;
  onCategory: (noteId: number, category: NoteCategoryView) => void;
  onDelete: (noteId: number) => void;
  onDuplicate: (noteId: number) => void;
  onPin: (note: NoteView) => void;
  onRename: (note: NoteView) => void;
  onSelect: (noteId: number) => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const category = categoryFor(note, categories);
  const color = colorFor(category?.color ?? note.color);

  return (
    <div
      className={cn(
        "group rounded-lg border border-transparent transition-colors",
        active ? "border-primary/25 bg-primary-soft/70 shadow-sm shadow-teal-900/5" : "hover:bg-accent/60"
      )}
    >
      <div
        className="flex w-full min-w-0 cursor-pointer items-center gap-3 px-2 py-2 text-left"
        role="button"
        tabIndex={0}
        onClick={() => onSelect(note.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(note.id);
          }
        }}
      >
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", color.soft, color.border)}>
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{note.title}</span>
            {note.isPinned && <Pin className="h-3 w-3 shrink-0 fill-amber-400 text-amber-500" aria-hidden="true" />}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
            {category?.name ? `${category.name} · ` : ""}
            {formatUpdated(note.updatedAt)}
          </span>
        </span>
        <button
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-100 transition hover:bg-card hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPin(note);
          }}
        >
          <Pin className={cn("h-3.5 w-3.5", note.isPinned && "fill-amber-400 text-amber-500")} aria-hidden="true" />
          <span className="sr-only">{note.isPinned ? "Unpin note" : "Pin note"}</span>
        </button>
        <button
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-100 transition hover:bg-card hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Open note actions</span>
        </button>
      </div>

      {menuOpen && (
        <div className="mx-2 mb-2 rounded-lg border border-border/75 bg-card p-2">
          <div className="grid grid-cols-4 gap-1">
            {categories.map((option) => {
              const optionColor = colorFor(option.color);
              return (
              <button
                key={option.id}
                className={cn("flex h-8 items-center justify-center rounded-md border bg-background hover:bg-accent", note.categoryId === option.id && "ring-2 ring-primary/20")}
                title={option.name}
                type="button"
                onClick={() => {
                  onCategory(note.id, option);
                  setMenuOpen(false);
                }}
              >
                <span className={cn("h-3 w-3 rounded-full", optionColor.dot)} />
              </button>
            )})}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1">
            <Button className="h-8 rounded-lg px-2 text-xs" variant="outline" onClick={() => onRename(note)}>
              Rename
            </Button>
            <Button className="h-8 rounded-lg px-2 text-xs" variant="outline" onClick={() => onDuplicate(note.id)}>
              Copy
            </Button>
            <Button className="h-8 rounded-lg px-2 text-xs text-rose-600" variant="outline" onClick={() => onDelete(note.id)}>
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditorToolbar({ editor }: { editor: Editor }) {
  function setLink() {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl ?? "");

    if (url === null) {
      return;
    }

    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-border/75 bg-card/95 px-4 py-2 backdrop-blur">
      <ToolbarButton active={editor.isActive("bold")} label="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("italic")} label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("strike")} label="Strike" onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("code")} label="Code" onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <span className="mx-1 h-6 w-px bg-border" />
      <ToolbarButton active={editor.isActive("heading", { level: 1 })} label="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("heading", { level: 2 })} label="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("bulletList")} label="Bulleted list" onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("orderedList")} label="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("taskList")} label="Task list" onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListChecks className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("blockquote")} label="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive("link")} label="Link" onClick={setLink}>
        <LinkIcon className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <span className="mx-1 h-6 w-px bg-border" />
      <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="h-4 w-4" aria-hidden="true" />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  active = false,
  children,
  label,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground", active && "bg-primary-soft text-primary")}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function BubbleButton({
  active = false,
  children,
  label,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn("flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground", active && "bg-primary-soft text-primary")}
      title={label}
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
