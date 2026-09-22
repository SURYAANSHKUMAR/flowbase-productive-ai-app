"use client";

import {
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  GripVertical,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Settings,
  Share2,
  Tags,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ClientSideSuspense, LiveblocksProvider, RoomProvider, useBroadcastEvent, useCreateComment, useCreateThread, useEventListener, useOthers, useSelf, useThreads } from "@liveblocks/react";
import { stringifyCommentBody } from "@liveblocks/client";

import {
  type KanbanLabel,
  type KanbanPriority,
  createKanbanBoard,
  createKanbanColumn,
  createKanbanTask,
  deleteKanbanColumn,
  deleteKanbanTask,
  moveKanbanTask,
  shareKanbanBoard,
  updateKanbanColumn,
  updateKanbanTask,
} from "@/app/kanban/actions";
import { Button } from "@/components/ui/button";
import "@/liveblocks.config";
import { cn } from "@/lib/utils";

export type KanbanBoardView = {
  id: number;
  name: string;
  color: string;
  isOwner: boolean;
  collaborators: KanbanCollaboratorView[];
};

export type KanbanCollaboratorView = {
  id: number;
  name: string;
  email: string;
  role: "owner" | "member";
};

export type KanbanCurrentUserView = {
  id: number;
  name: string;
  email: string;
};

export type KanbanColumnView = {
  id: number;
  boardId: number;
  name: string;
  position: number;
};

export type KanbanTaskView = {
  id: number;
  boardId: number;
  columnId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: KanbanPriority;
  categoryId: number | null;
  labels: KanbanLabel[];
  syncCalendar: boolean;
  calendarItemId: number | null;
  linkNotes: boolean;
  position: number;
};

export type KanbanCategoryView = {
  id: number;
  name: string;
  color: string;
  icon: string;
};

type DialogMode = "create" | "edit";
type TaskDialogTab = "details" | "comments";

const boardColorOptions = [
  { value: "teal", label: "Teal" },
  { value: "sky", label: "Sky" },
  { value: "rose", label: "Rose" },
  { value: "amber", label: "Amber" },
  { value: "emerald", label: "Emerald" },
  { value: "violet", label: "Violet" },
];

const labelColorOptions = [
  ...boardColorOptions,
  { value: "slate", label: "Slate" },
];

const boardColorStyles: Record<string, string> = {
  teal: "bg-teal-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
};

const boardSoftStyles: Record<string, string> = {
  teal: "border-teal-100 bg-teal-50 text-teal-700",
  sky: "border-sky-100 bg-sky-50 text-sky-700",
  rose: "border-rose-100 bg-rose-50 text-rose-700",
  amber: "border-amber-100 bg-amber-50 text-amber-700",
  emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  violet: "border-violet-100 bg-violet-50 text-violet-700",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
};

const priorityStyles: Record<KanbanPriority, string> = {
  low: "border-sky-100 bg-sky-50 text-sky-700",
  medium: "border-amber-100 bg-amber-50 text-amber-700",
  high: "border-rose-100 bg-rose-50 text-rose-700",
};

const priorityLabels: Record<KanbanPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDueDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);

  return letters.toUpperCase();
}

function avatarColor(value: string) {
  const colors = ["#0f766e", "#0284c7", "#be123c", "#b45309", "#059669", "#7c3aed", "#475569"];
  const total = value.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);

  return colors[total % colors.length];
}

function commentBody(message: string) {
  return {
    version: 1 as const,
    content: [
      {
        type: "paragraph" as const,
        children: [{ text: message }],
      },
    ],
  };
}

function roomIdForBoard(boardId: number) {
  return `kanban-board:${boardId}`;
}

export function KanbanWorkspace({
  boards,
  categories,
  collaborationEnabled,
  columns,
  currentUser,
  defaultPriority,
  tasks,
}: {
  boards: KanbanBoardView[];
  categories: KanbanCategoryView[];
  collaborationEnabled: boolean;
  columns: KanbanColumnView[];
  currentUser: KanbanCurrentUserView;
  defaultPriority: KanbanPriority;
  tasks: KanbanTaskView[];
}) {
  const router = useRouter();
  const [selectedBoardId, setSelectedBoardId] = React.useState<number | null>(boards[0]?.id ?? null);
  const [boardDialogOpen, setBoardDialogOpen] = React.useState(false);
  const [collaborationOpen, setCollaborationOpen] = React.useState(false);
  const [taskDialog, setTaskDialog] = React.useState<
    | {
        mode: DialogMode;
        columnId: number;
        task: KanbanTaskView | null;
        initialTab?: TaskDialogTab;
      }
    | null
  >(null);
  const [editingColumnId, setEditingColumnId] = React.useState<number | null>(null);
  const [columnNameDraft, setColumnNameDraft] = React.useState("");
  const [newColumnName, setNewColumnName] = React.useState("");
  const [pendingDropId, setPendingDropId] = React.useState<number | null>(null);
  const [error, setError] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const broadcastBoardChangeRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (selectedBoardId && boards.some((board) => board.id === selectedBoardId)) {
      return;
    }

    setSelectedBoardId(boards[0]?.id ?? null);
  }, [boards, selectedBoardId]);

  const selectedBoard = boards.find((board) => board.id === selectedBoardId) ?? null;
  const selectedColumns = React.useMemo(
    () => columns.filter((column) => column.boardId === selectedBoardId).sort((a, b) => a.position - b.position),
    [columns, selectedBoardId]
  );
  const tasksByColumn = React.useMemo(() => {
    const grouped = new Map<number, KanbanTaskView[]>();

    tasks.forEach((task) => {
      const current = grouped.get(task.columnId) ?? [];
      grouped.set(task.columnId, [...current, task]);
    });

    grouped.forEach((columnTasks, columnId) => {
      grouped.set(
        columnId,
        [...columnTasks].sort((first, second) => first.position - second.position)
      );
    });

    return grouped;
  }, [tasks]);

  function refresh() {
    router.refresh();
  }

  function notifyBoardChanged() {
    broadcastBoardChangeRef.current?.();
  }

  function addColumn() {
    if (!selectedBoard || selectedColumns.length >= 5) {
      return;
    }

    setError("");
    startTransition(async () => {
      try {
        await createKanbanColumn(selectedBoard.id, newColumnName);
        setNewColumnName("");
        notifyBoardChanged();
        refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to add column.");
      }
    });
  }

  function beginEditColumn(column: KanbanColumnView) {
    setEditingColumnId(column.id);
    setColumnNameDraft(column.name);
  }

  function saveColumnName(columnId: number) {
    setError("");
    startTransition(async () => {
      try {
        await updateKanbanColumn(columnId, columnNameDraft);
        setEditingColumnId(null);
        setColumnNameDraft("");
        notifyBoardChanged();
        refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to update column.");
      }
    });
  }

  function removeColumn(columnId: number) {
    setError("");
    startTransition(async () => {
      try {
        await deleteKanbanColumn(columnId);
        notifyBoardChanged();
        refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to delete column.");
      }
    });
  }

  function handleTaskDrop(event: React.DragEvent, columnId: number) {
    event.preventDefault();
    const taskId = Number(event.dataTransfer.getData("text/kanban-task-id"));

    if (!taskId) {
      return;
    }

    setPendingDropId(taskId);
    startTransition(async () => {
      try {
        await moveKanbanTask(taskId, columnId);
        notifyBoardChanged();
        refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to move task.");
      } finally {
        setPendingDropId(null);
      }
    });
  }

  const content = (
    <section className="flex min-w-0 flex-1 flex-col">
      {selectedBoard && collaborationEnabled && <BoardRealtimeBridge boardId={selectedBoard.id} onReady={(broadcast) => (broadcastBoardChangeRef.current = broadcast)} />}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/75 bg-background/70 px-4 py-4 backdrop-blur sm:px-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Task Board</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">
            {selectedBoard ? selectedBoard.name : "Kanban boards"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {selectedBoard && (
            <Button className="h-9 rounded-lg gap-2" variant="outline" onClick={() => setCollaborationOpen(true)}>
              <Users className="h-4 w-4" aria-hidden="true" />
              Collaboration
            </Button>
          )}
          <Button className="h-9 rounded-lg gap-2" onClick={() => setBoardDialogOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New board
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-5 px-4 py-5 lg:grid-cols-[260px_minmax(0,1fr)] sm:px-6">
        <aside className="min-w-0 rounded-lg border border-border/75 bg-card/95 p-4 shadow-sm shadow-slate-900/[0.025]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Boards</p>
              <h2 className="mt-1 text-base font-semibold text-card-foreground">Workspace views</h2>
            </div>
            <Button className="h-8 w-8 rounded-lg" size="icon" variant="outline" onClick={() => setBoardDialogOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Create board</span>
            </Button>
          </div>

          <div className="mt-4 space-y-1.5">
            {boards.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                Create your first board to organize tasks by status.
              </div>
            ) : (
              boards.map((board) => {
                const isActive = board.id === selectedBoardId;

                return (
                  <button
                    key={board.id}
                    className={cn(
                      "flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-transparent px-2.5 text-left text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-accent/70",
                      isActive && "border-primary/25 bg-primary-soft/70 text-foreground shadow-sm shadow-teal-900/5"
                    )}
                    type="button"
                    onClick={() => setSelectedBoardId(board.id)}
                  >
                    <span className={cn("h-3 w-3 shrink-0 rounded-full", boardColorStyles[board.color] ?? boardColorStyles.teal)} />
                    <span className="truncate">{board.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col rounded-lg border border-border/75 bg-card/95 shadow-sm shadow-slate-900/[0.025]">
          {selectedBoard ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/75 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-lg border",
                      boardSoftStyles[selectedBoard.color] ?? boardSoftStyles.teal
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-card-foreground">{selectedBoard.name}</h2>
                    <p className="text-xs font-medium text-muted-foreground">{selectedColumns.length}/5 columns</p>
                  </div>
                </div>

                <div className="flex min-w-[240px] max-w-full flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
                  {collaborationEnabled ? (
                    <ActiveCollaborators board={selectedBoard} currentUser={currentUser} />
                  ) : (
                    <StaticCollaborators board={selectedBoard} currentUser={currentUser} />
                  )}
                  <Button className="h-9 w-9 rounded-lg" size="icon" variant="outline" onClick={() => setCollaborationOpen(true)}>
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Open collaboration settings</span>
                  </Button>
                  <input
                    className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 sm:w-52"
                    disabled={selectedColumns.length >= 5 || isPending}
                    placeholder={selectedColumns.length >= 5 ? "Column limit reached" : "New column"}
                    value={newColumnName}
                    onChange={(event) => setNewColumnName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        addColumn();
                      }
                    }}
                  />
                  <Button
                    className="h-9 w-9 rounded-lg"
                    disabled={selectedColumns.length >= 5 || isPending}
                    size="icon"
                    variant="outline"
                    onClick={addColumn}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Add column</span>
                  </Button>
                </div>
              </div>

              {error && <p className="mx-4 mt-3 rounded-lg border border-destructive/20 bg-red-50 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}

              <div className="min-h-0 flex-1 overflow-x-auto p-4">
                <div className="flex min-h-[600px] w-max gap-3">
                  {selectedColumns.map((column) => {
                    const columnTasks = tasksByColumn.get(column.id) ?? [];
                    const isEditingColumn = editingColumnId === column.id;

                    return (
                      <section
                        key={column.id}
                        className={cn(
                          "flex max-h-[calc(100dvh-190px)] w-[280px] shrink-0 flex-col rounded-lg border border-border/75 bg-background/85",
                          pendingDropId && "transition-colors"
                        )}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleTaskDrop(event, column.id)}
                      >
                        <div className="border-b border-border/75 p-3">
                          <div className="flex items-center justify-between gap-2">
                            {isEditingColumn ? (
                              <input
                                className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-card px-2 text-sm font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                                value={columnNameDraft}
                                onChange={(event) => setColumnNameDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    saveColumnName(column.id);
                                  }

                                  if (event.key === "Escape") {
                                    setEditingColumnId(null);
                                  }
                                }}
                              />
                            ) : (
                              <div className="flex min-w-0 items-center gap-2">
                                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <h3 className="truncate text-sm font-semibold text-foreground">{column.name}</h3>
                                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                                  {columnTasks.length}
                                </span>
                              </div>
                            )}

                            <div className="flex shrink-0 items-center gap-1">
                              {isEditingColumn ? (
                                <>
                                  <Button className="h-7 w-7 rounded-lg" size="icon" variant="ghost" onClick={() => saveColumnName(column.id)}>
                                    <Check className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
                                    <span className="sr-only">Save column name</span>
                                  </Button>
                                  <Button className="h-7 w-7 rounded-lg" size="icon" variant="ghost" onClick={() => setEditingColumnId(null)}>
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span className="sr-only">Cancel column edit</span>
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button className="h-7 w-7 rounded-lg" size="icon" variant="ghost" onClick={() => beginEditColumn(column)}>
                                    <Pencil className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
                                    <span className="sr-only">Edit column</span>
                                  </Button>
                                  <Button className="h-7 w-7 rounded-lg" size="icon" variant="ghost" onClick={() => removeColumn(column.id)}>
                                    <Trash2 className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                                    <span className="sr-only">Delete column</span>
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>

                          <Button
                            className="mt-3 h-8 w-full rounded-lg gap-2"
                            size="sm"
                            variant="outline"
                            onClick={() => setTaskDialog({ mode: "create", columnId: column.id, task: null })}
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            Add task
                          </Button>
                        </div>

                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                          {columnTasks.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border bg-card/80 p-3 text-sm leading-6 text-muted-foreground">
                              Drop tasks here or add a new one.
                            </div>
                          ) : (
                            columnTasks.map((task) => (
                              <TaskCard
                                key={task.id}
                                categories={categories}
                                showComments={collaborationEnabled}
                                task={task}
                                onComments={() => setTaskDialog({ mode: "edit", columnId: task.columnId, task, initialTab: "comments" })}
                                onEdit={() => setTaskDialog({ mode: "edit", columnId: task.columnId, task, initialTab: "details" })}
                                onDelete={() => {
                                  setError("");
                                  startTransition(async () => {
                                    try {
                                      await deleteKanbanTask(task.id);
                                      notifyBoardChanged();
                                      refresh();
                                    } catch (caughtError) {
                                      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete task.");
                                    }
                                  });
                                }}
                              />
                            ))
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[520px] flex-1 items-center justify-center p-6">
              <div className="max-w-sm text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <ClipboardList className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-card-foreground">Create a Kanban board</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Boards start with Todo, In Progress, and Done so you can begin organizing tasks right away.
                </p>
                <Button className="mt-4 rounded-lg gap-2" onClick={() => setBoardDialogOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  New board
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {boardDialogOpen && (
        <CreateBoardDialog
          onClose={() => setBoardDialogOpen(false)}
          onCreated={(boardId) => {
            setBoardDialogOpen(false);
            setSelectedBoardId(boardId);
            refresh();
          }}
        />
      )}

      {collaborationOpen && selectedBoard && (
        <CollaborationDialog
          board={selectedBoard}
          onClose={() => setCollaborationOpen(false)}
          onShared={() => {
            notifyBoardChanged();
            refresh();
          }}
        />
      )}

      {taskDialog && selectedBoard && (
        <TaskDialog
          boardId={selectedBoard.id}
          boardCollaborators={selectedBoard.collaborators}
          canSyncCalendar={selectedBoard.isOwner}
          categories={categories}
          collaborationEnabled={collaborationEnabled}
          columns={selectedColumns}
          currentUser={currentUser}
          defaultPriority={defaultPriority}
          initialTab={taskDialog.initialTab ?? "details"}
          initialColumnId={taskDialog.columnId}
          mode={taskDialog.mode}
          task={taskDialog.task}
          onClose={() => setTaskDialog(null)}
          onSaved={() => {
            setTaskDialog(null);
            notifyBoardChanged();
            refresh();
          }}
        />
      )}
    </section>
  );

  if (!selectedBoard || !collaborationEnabled) {
    return content;
  }

  return <KanbanBoardRoom boardId={selectedBoard.id}>{content}</KanbanBoardRoom>;
}

function TaskCard({
  categories,
  showComments,
  task,
  onComments,
  onEdit,
  onDelete,
}: {
  categories: KanbanCategoryView[];
  showComments: boolean;
  task: KanbanTaskView;
  onComments: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const category = categories.find((current) => current.id === task.categoryId);

  function handleDragStart(event: React.DragEvent) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/kanban-task-id", String(task.id));
  }

  return (
    <article
      className="group rounded-lg border border-border/75 bg-card p-3 shadow-sm shadow-slate-900/[0.025] transition hover:border-primary/35 hover:shadow-md hover:shadow-slate-900/[0.04]"
      draggable
      onDragStart={handleDragStart}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />
            <h4 className="truncate text-sm font-semibold text-card-foreground">{task.title}</h4>
          </div>
          {task.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{task.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          <Button className="h-7 w-7 rounded-lg" size="icon" variant="ghost" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
            <span className="sr-only">Edit task</span>
          </Button>
          <Button className="h-7 w-7 rounded-lg" size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
            <span className="sr-only">Delete task</span>
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-bold", priorityStyles[task.priority])}>
          {priorityLabels[task.priority]}
        </span>
        {category && (
          <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-bold", boardSoftStyles[category.color] ?? boardSoftStyles.teal)}>
            {category.name}
          </span>
        )}
        <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
          Due {formatDueDate(task.dueDate)}
        </span>
      </div>

      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {task.labels.map((label) => (
            <span key={`${label.name}-${label.color}`} className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-bold", boardSoftStyles[label.color] ?? boardSoftStyles.teal)}>
              {label.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-muted-foreground">
        {task.syncCalendar && (
          <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-1.5 py-0.5 text-[11px] font-semibold text-teal-700">
            <CalendarDays className="h-3 w-3" aria-hidden="true" />
            Calendar
          </span>
        )}
        {task.linkNotes && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
            <FileText className="h-3 w-3" aria-hidden="true" />
            Notes
          </span>
        )}
        {showComments && (
          <button
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/30 hover:text-primary"
            type="button"
            onClick={onComments}
          >
            <MessageCircle className="h-3 w-3" aria-hidden="true" />
            <TaskCommentCount boardId={task.boardId} taskId={task.id} />
            <span className="sr-only">Open task comments</span>
          </button>
        )}
      </div>
    </article>
  );
}

function KanbanBoardRoom({ boardId, children }: { boardId: number; children: React.ReactNode }) {
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <RoomProvider id={roomIdForBoard(boardId)} initialPresence={{ selectedTaskId: null }}>
        <ClientSideSuspense
          fallback={
            <section className="flex min-w-0 flex-1 items-center justify-center p-6 text-sm font-medium text-muted-foreground">
              Loading collaboration...
            </section>
          }
        >
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

function BoardRealtimeBridge({ boardId, onReady }: { boardId: number; onReady: (broadcast: () => void) => void }) {
  const router = useRouter();
  const broadcast = useBroadcastEvent();

  React.useEffect(() => {
    onReady(() => broadcast({ type: "board:changed", boardId }));
    return () => onReady(() => undefined);
  }, [boardId, broadcast, onReady]);

  useEventListener(({ event }) => {
    if (event.type === "board:changed" && event.boardId === boardId) {
      router.refresh();
    }
  });

  return null;
}

function ActiveCollaborators({ board, currentUser }: { board: KanbanBoardView; currentUser: KanbanCurrentUserView }) {
  const others = useOthers();
  const self = useSelf();
  const activeUsers = [
    {
      id: String(currentUser.id),
      name: self?.info.name ?? currentUser.name,
      email: self?.info.email ?? currentUser.email,
      color: self?.info.color ?? avatarColor(currentUser.email),
      isSelf: true,
    },
    ...others.map((other) => ({
      id: other.id,
      name: other.info.name,
      email: other.info.email,
      color: other.info.color,
      isSelf: false,
    })),
  ];

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1">
      <div className="flex -space-x-2">
        {activeUsers.slice(0, 5).map((user) => (
          <span
            key={`${user.id}-${user.email}`}
            className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-[10px] font-bold text-white shadow-sm"
            style={{ backgroundColor: user.color }}
            title={`${user.name}${user.isSelf ? " (you)" : ""}`}
          >
            {initialsFor(user.name)}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-400" />
          </span>
        ))}
      </div>
      <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">
        {activeUsers.length}/{Math.max(board.collaborators.length, activeUsers.length)} active
      </span>
    </div>
  );
}

function StaticCollaborators({ board, currentUser }: { board: KanbanBoardView; currentUser: KanbanCurrentUserView }) {
  const collaborators = board.collaborators.length > 0 ? board.collaborators : [{ ...currentUser, role: "owner" as const }];

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1">
      <div className="flex -space-x-2">
        {collaborators.slice(0, 5).map((user) => (
          <span
            key={`${user.id}-${user.email}`}
            className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-[10px] font-bold text-white shadow-sm"
            style={{ backgroundColor: avatarColor(user.email) }}
            title={user.name}
          >
            {initialsFor(user.name)}
          </span>
        ))}
      </div>
      <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">{collaborators.length} saved</span>
    </div>
  );
}

function TaskCommentCount({ boardId, taskId }: { boardId: number; taskId: number }) {
  const { threads } = useThreads({ query: { metadata: { boardId, taskId } } });
  const count = threads?.reduce((total, thread) => total + thread.comments.length, 0) ?? 0;

  return <span>{count}</span>;
}

function CollaborationDialog({
  board,
  onClose,
  onShared,
}: {
  board: KanbanBoardView;
  onClose: () => void;
  onShared: () => void;
}) {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  function inviteUser() {
    setError("");
    startTransition(async () => {
      try {
        await shareKanbanBoard(board.id, email);
        setEmail("");
        onShared();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to invite collaborator.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/30 backdrop-blur-sm">
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl shadow-slate-900/10">
        <div className="flex items-start justify-between gap-4 border-b border-border/75 p-5">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Share2 className="h-4 w-4 text-teal-600" aria-hidden="true" />
              Collaboration
            </p>
            <h2 className="mt-1 text-xl font-semibold text-card-foreground">{board.name}</h2>
          </div>
          <Button className="h-8 w-8 rounded-lg" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Close collaboration panel</span>
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div>
            <p className="text-sm font-semibold text-foreground">Shared with</p>
            <div className="mt-3 space-y-2">
              {board.collaborators.map((collaborator) => (
                <div key={collaborator.id} className="flex items-center gap-3 rounded-lg border border-border/75 bg-background/80 p-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: avatarColor(collaborator.email) }}
                  >
                    {initialsFor(collaborator.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{collaborator.name}</p>
                    <p className="truncate text-xs font-medium text-muted-foreground">{collaborator.email}</p>
                  </div>
                  <span className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                    {collaborator.role === "owner" ? "Owner" : "Member"}
                  </span>
                </div>
              ))}
              {board.collaborators.length <= 1 && (
                <div className="rounded-lg border border-dashed border-border bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                  Invite a teammate to start collaborating on this board.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/75 bg-background/85 p-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-teal-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">Invite by email</p>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                disabled={!board.isOwner || isPending}
                placeholder={board.isOwner ? "teammate@example.com" : "Only the owner can invite"}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    inviteUser();
                  }
                }}
              />
              <Button className="h-10 rounded-lg gap-2" disabled={!board.isOwner || isPending} onClick={inviteUser}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Invite
              </Button>
            </div>
            {error && <p className="mt-3 rounded-lg border border-destructive/20 bg-red-50 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}

function CreateBoardDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (boardId: number) => void;
}) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("teal");
  const [error, setError] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  function saveBoard() {
    setError("");
    startTransition(async () => {
      try {
        const boardId = await createKanbanBoard({ name, color });
        onCreated(boardId);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to create board.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl shadow-slate-900/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">New Kanban board</p>
            <h2 className="mt-1 text-xl font-semibold text-card-foreground">Create board</h2>
          </div>
          <Button className="h-8 w-8 rounded-lg" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Close dialog</span>
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-foreground">Board name</span>
            <input
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Launch plan"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  saveBoard();
                }
              }}
            />
          </label>

          <div>
            <p className="text-sm font-semibold text-foreground">Board color</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {boardColorOptions.map((option) => (
                <button
                  key={option.value}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-2 text-sm font-semibold transition hover:bg-accent",
                    color === option.value && "border-primary bg-primary-soft text-primary"
                  )}
                  type="button"
                  onClick={() => setColor(option.value)}
                >
                  <span className={cn("h-3 w-3 shrink-0 rounded-full", boardColorStyles[option.value])} />
                  <span className="truncate">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="rounded-lg border border-destructive/20 bg-red-50 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button className="rounded-lg" disabled={isPending} variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button className="rounded-lg" disabled={isPending} onClick={saveBoard}>
            Create board
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskDialog({
  boardId,
  boardCollaborators,
  canSyncCalendar,
  categories,
  collaborationEnabled,
  columns,
  currentUser,
  defaultPriority,
  initialTab,
  initialColumnId,
  mode,
  task,
  onClose,
  onSaved,
}: {
  boardId: number;
  boardCollaborators: KanbanCollaboratorView[];
  canSyncCalendar: boolean;
  categories: KanbanCategoryView[];
  collaborationEnabled: boolean;
  columns: KanbanColumnView[];
  currentUser: KanbanCurrentUserView;
  defaultPriority: KanbanPriority;
  initialTab: TaskDialogTab;
  initialColumnId: number;
  mode: DialogMode;
  task: KanbanTaskView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [columnId, setColumnId] = React.useState(task?.columnId ?? initialColumnId);
  const [title, setTitle] = React.useState(task?.title ?? "");
  const [description, setDescription] = React.useState(task?.description ?? "");
  const [dueDate, setDueDate] = React.useState(task?.dueDate ?? todayKey());
  const [priority, setPriority] = React.useState<KanbanPriority>(task?.priority ?? defaultPriority);
  const [categoryId, setCategoryId] = React.useState<number | null>(
    task?.categoryId ?? categories.find((category) => category.name.toLowerCase().includes(task?.priority ?? defaultPriority))?.id ?? categories[0]?.id ?? null
  );
  const [labels, setLabels] = React.useState<KanbanLabel[]>(task?.labels ?? []);
  const [labelName, setLabelName] = React.useState("");
  const [labelColor, setLabelColor] = React.useState("teal");
  const [syncCalendar, setSyncCalendar] = React.useState(task?.syncCalendar ?? false);
  const [linkNotes, setLinkNotes] = React.useState(task?.linkNotes ?? false);
  const [error, setError] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<TaskDialogTab>(collaborationEnabled ? initialTab : "details");
  const [isPending, startTransition] = React.useTransition();
  const isEditing = mode === "edit" && Boolean(task);

  function addLabel() {
    const name = labelName.trim();

    if (!name || labels.length >= 6) {
      return;
    }

    setLabels((current) => [...current, { name, color: labelColor }]);
    setLabelName("");
  }

  function saveTask() {
    setError("");
    startTransition(async () => {
      try {
        const input = {
          boardId,
          columnId,
          title,
          description,
          dueDate,
          priority,
          categoryId,
          labels,
          syncCalendar,
          linkNotes,
        };

        if (isEditing && task) {
          await updateKanbanTask(task.id, input);
        } else {
          await createKanbanTask(input);
        }

        onSaved();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to save task.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[calc(100dvh-48px)] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-xl shadow-slate-900/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{isEditing ? "Update task details" : "Add task"}</p>
            <h2 className="mt-1 text-xl font-semibold text-card-foreground">{isEditing ? "Edit task" : "New task"}</h2>
          </div>
          <Button className="h-8 w-8 rounded-lg" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Close dialog</span>
          </Button>
        </div>

        {isEditing && collaborationEnabled && (
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            <button
              className={cn("h-9 rounded-md text-sm font-semibold transition", activeTab === "details" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              type="button"
              onClick={() => setActiveTab("details")}
            >
              Details
            </button>
            <button
              className={cn("h-9 rounded-md text-sm font-semibold transition", activeTab === "comments" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              type="button"
              onClick={() => setActiveTab("comments")}
            >
              Comments
            </button>
          </div>
        )}

        {activeTab === "details" ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <label className="block">
              <span className="text-sm font-semibold text-foreground">Title</span>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Write launch checklist"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-foreground">Column</span>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={columnId}
                onChange={(event) => setColumnId(Number(event.target.value))}
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-foreground">Description</span>
            <textarea
              className="mt-1 min-h-24 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Add details, blockers, or next steps"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-foreground">Due date</span>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>

            <div>
              <p className="text-sm font-semibold text-foreground">Priority</p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {(["low", "medium", "high"] as const).map((currentPriority) => (
                  <button
                    key={currentPriority}
                    className={cn(
                      "h-10 rounded-lg border px-2 text-xs font-bold transition-colors",
                      priorityStyles[currentPriority],
                      priority === currentPriority && "ring-2 ring-primary/25"
                    )}
                    type="button"
                    onClick={() => setPriority(currentPriority)}
                  >
                    {priorityLabels[currentPriority]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Category</p>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {categories.map((currentCategory) => (
                <button
                  key={currentCategory.id}
                  className={cn(
                    "h-10 rounded-lg border px-2 text-xs font-bold transition-colors",
                    boardSoftStyles[currentCategory.color] ?? boardSoftStyles.teal,
                    categoryId === currentCategory.id && "ring-2 ring-primary/25"
                  )}
                  type="button"
                  onClick={() => setCategoryId(currentCategory.id)}
                >
                  {currentCategory.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-teal-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">Labels</p>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px_80px]">
              <input
                className="h-10 min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                disabled={labels.length >= 6}
                placeholder={labels.length >= 6 ? "Label limit reached" : "Label name"}
                value={labelName}
                onChange={(event) => setLabelName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addLabel();
                  }
                }}
              />
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={labelColor}
                onChange={(event) => setLabelColor(event.target.value)}
              >
                {labelColorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button className="h-10 rounded-lg" disabled={labels.length >= 6} type="button" variant="outline" onClick={addLabel}>
                Add
              </Button>
            </div>
            {labels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {labels.map((label, index) => (
                  <button
                    key={`${label.name}-${label.color}-${index}`}
                    className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold", boardSoftStyles[label.color] ?? boardSoftStyles.teal)}
                    type="button"
                    onClick={() => setLabels((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                  >
                    {label.name}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-lg border border-border/75 bg-background/80 p-3 text-sm font-semibold text-foreground">
              <input
                className="h-4 w-4 accent-teal-600"
                checked={syncCalendar}
                disabled={!canSyncCalendar}
                type="checkbox"
                onChange={(event) => setSyncCalendar(event.target.checked)}
              />
              <CalendarDays className="h-4 w-4 text-teal-600" aria-hidden="true" />
              {canSyncCalendar ? "Sync with Calendar" : "Calendar sync is owner-only"}
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-border/75 bg-background/80 p-3 text-sm font-semibold text-foreground">
              <input
                className="h-4 w-4 accent-amber-500"
                checked={linkNotes}
                type="checkbox"
                onChange={(event) => setLinkNotes(event.target.checked)}
              />
              <FileText className="h-4 w-4 text-amber-600" aria-hidden="true" />
              Link with Notes
            </label>
          </div>

          {error && <p className="rounded-lg border border-destructive/20 bg-red-50 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
        </div>
        ) : task ? (
          <TaskCommentsPanel boardCollaborators={boardCollaborators} boardId={boardId} currentUser={currentUser} task={task} />
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button className="rounded-lg" disabled={isPending} variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {activeTab === "details" && (
            <Button className="rounded-lg gap-2" disabled={isPending} onClick={saveTask}>
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              {isEditing ? "Save changes" : "Create task"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCommentsPanel({
  boardCollaborators,
  boardId,
  currentUser,
  task,
}: {
  boardCollaborators: KanbanCollaboratorView[];
  boardId: number;
  currentUser: KanbanCurrentUserView;
  task: KanbanTaskView;
}) {
  const { threads, isLoading } = useThreads({ query: { metadata: { boardId, taskId: task.id } } });
  const createThread = useCreateThread();
  const createComment = useCreateComment();
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const sortedThreads = [...(threads ?? [])].sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime());
  const comments = sortedThreads.flatMap((thread) => thread.comments.map((comment) => ({ threadId: thread.id, comment })));

  function addComment() {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    setError("");
    startTransition(() => {
      try {
        const body = commentBody(trimmedMessage);
        const targetThread = sortedThreads[0];

        if (targetThread) {
          createComment({ threadId: targetThread.id, body });
        } else {
          createThread({
            body,
            metadata: {
              boardId,
              taskId: task.id,
            },
          });
        }

        setMessage("");
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to add comment.");
      }
    });
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-lg border border-border/75 bg-background/80 p-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-teal-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">Discussion</p>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">{comments.length}</span>
        </div>

        <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
          {isLoading ? (
            <p className="rounded-lg border border-dashed border-border bg-card/80 p-3 text-sm text-muted-foreground">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card/80 p-3 text-sm leading-6 text-muted-foreground">
              No comments yet. Start the thread with a note, blocker, or decision.
            </p>
          ) : (
            comments.map(({ threadId, comment }) => {
              const author = boardCollaborators.find((collaborator) => String(collaborator.id) === comment.userId);
              const authorName = author?.name ?? (comment.userId === String(currentUser.id) ? currentUser.name : `User ${comment.userId}`);
              const authorEmail = author?.email ?? (comment.userId === String(currentUser.id) ? currentUser.email : "");

              return (
                <div key={`${threadId}-${comment.id}`} className="flex gap-3 rounded-lg border border-border/75 bg-card p-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: avatarColor(authorEmail || comment.userId) }}
                  >
                    {initialsFor(authorName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-foreground">{authorName}</p>
                      <time className="text-xs font-medium text-muted-foreground">
                        {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(comment.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {comment.body ? stringifyCommentBody(comment.body) : "Comment unavailable"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border/75 bg-background/85 p-3">
        <textarea
          className="min-h-20 w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          placeholder="Add a comment"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        {error && <p className="mt-2 rounded-lg border border-destructive/20 bg-red-50 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
        <div className="mt-2 flex justify-end">
          <Button className="rounded-lg gap-2" disabled={isPending || !message.trim()} onClick={addComment}>
            <Send className="h-4 w-4" aria-hidden="true" />
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
