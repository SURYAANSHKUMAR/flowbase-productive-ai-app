"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Download,
  FilePenLine,
  LayoutPanelLeft,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Sparkles,
  StickyNote,
  Trash2,
} from "lucide-react";
import * as React from "react";

import {
  type DiagramSpec,
  createWhiteboard,
  deleteWhiteboard,
  generateDiagram,
  renameWhiteboard,
  saveWhiteboard,
} from "@/app/whiteboard/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const Excalidraw = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm font-semibold text-muted-foreground">Loading canvas...</div>,
});

export type WhiteboardView = {
  id: number;
  name: string;
  color: string;
  elements: Record<string, unknown>[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type SaveStatus = "saved" | "saving" | "error";
type ExcalidrawApi = import("@excalidraw/excalidraw/types").ExcalidrawImperativeAPI;
type BinaryFiles = import("@excalidraw/excalidraw/types").BinaryFiles;
type AppState = import("@excalidraw/excalidraw/types").AppState;
type ExcalidrawElement = import("@excalidraw/excalidraw/element/types").ExcalidrawElement;
type ExcalidrawElementSkeleton = import("@excalidraw/excalidraw/data/transform").ExcalidrawElementSkeleton;
type LatestScene = { elements: readonly ExcalidrawElement[]; appState: AppState; files: BinaryFiles };

const boardColors = [
  { value: "teal", label: "Teal", dot: "bg-teal-500", hex: "#0f766e" },
  { value: "sky", label: "Sky", dot: "bg-sky-500", hex: "#0284c7" },
  { value: "rose", label: "Rose", dot: "bg-rose-500", hex: "#e11d48" },
  { value: "amber", label: "Amber", dot: "bg-amber-500", hex: "#d97706" },
  { value: "emerald", label: "Emerald", dot: "bg-emerald-500", hex: "#059669" },
  { value: "violet", label: "Violet", dot: "bg-violet-500", hex: "#7c3aed" },
  { value: "slate", label: "Slate", dot: "bg-slate-500", hex: "#475569" },
];

const colorPicks = ["#1f2937", "#0f766e", "#0284c7", "#7c3aed", "#e11d48", "#d97706"];
const backgroundPicks = ["transparent", "#ccfbf1", "#e0f2fe", "#ede9fe", "#ffe4e6", "#fef3c7"];
const canvasPicks = ["#ffffff", "#f8fafc", "#f0fdfa", "#f0f9ff", "#fff7ed", "#faf5ff"];
const stickyPicks = ["#fef3c7", "#ccfbf1", "#e0f2fe", "#ede9fe", "#ffe4e6", "#dcfce7"];

const defaultAppState = {
  viewBackgroundColor: "#f8fafc",
  currentItemStrokeColor: "#1f2937",
  currentItemBackgroundColor: "transparent",
};

function colorFor(value: string) {
  return boardColors.find((color) => color.value === value) ?? boardColors[0];
}

function formatUpdated(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat("en", isToday ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric" }).format(date);
}

function sanitizeAppState(appState: AppState) {
  return {
    viewBackgroundColor: appState.viewBackgroundColor,
    currentItemStrokeColor: appState.currentItemStrokeColor,
    currentItemBackgroundColor: appState.currentItemBackgroundColor,
    currentItemFillStyle: appState.currentItemFillStyle,
    currentItemStrokeWidth: appState.currentItemStrokeWidth,
    currentItemStrokeStyle: appState.currentItemStrokeStyle,
    currentItemRoughness: appState.currentItemRoughness,
    currentItemOpacity: appState.currentItemOpacity,
    currentItemFontFamily: appState.currentItemFontFamily,
    currentItemFontSize: appState.currentItemFontSize,
    currentItemTextAlign: appState.currentItemTextAlign,
    currentItemStartArrowhead: appState.currentItemStartArrowhead,
    currentItemEndArrowhead: appState.currentItemEndArrowhead,
    currentItemRoundness: appState.currentItemRoundness,
    gridModeEnabled: appState.gridModeEnabled,
    theme: appState.theme,
    name: appState.name,
  };
}

function slugFileName(value: string) {
  return `${(value.trim() || "whiteboard").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80)}.png`;
}

export function WhiteboardWorkspace({ whiteboards }: { whiteboards: WhiteboardView[] }) {
  const router = useRouter();
  const [localBoards, setLocalBoards] = React.useState(whiteboards);
  const [selectedBoardId, setSelectedBoardId] = React.useState<number | null>(whiteboards[0]?.id ?? null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("saved");
  const [error, setError] = React.useState("");
  const [strokeColor, setStrokeColor] = React.useState("#1f2937");
  const [backgroundColor, setBackgroundColor] = React.useState("transparent");
  const [textColor, setTextColor] = React.useState("#1f2937");
  const [stickyColor, setStickyColor] = React.useState("#fef3c7");
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiPending, setAiPending] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const apiRef = React.useRef<ExcalidrawApi | null>(null);
  const latestSceneRef = React.useRef<LatestScene | null>(null);
  const saveTimeoutRef = React.useRef<number | null>(null);
  const activeBoardIdRef = React.useRef<number | null>(whiteboards[0]?.id ?? null);
  const saveStatusRef = React.useRef<SaveStatus>("saved");
  const saveVersionRef = React.useRef(0);

  React.useEffect(() => {
    setLocalBoards(whiteboards);
    setSelectedBoardId((current) => {
      if (current && whiteboards.some((board) => board.id === current)) {
        return current;
      }
      return whiteboards[0]?.id ?? null;
    });
  }, [whiteboards]);

  const selectedBoard = localBoards.find((board) => board.id === selectedBoardId) ?? null;
  const activeBoardId = selectedBoard?.id ?? null;

  const clearPendingSave = React.useCallback(() => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  const setSaveStatusSafely = React.useCallback((status: SaveStatus) => {
    if (saveStatusRef.current === status) {
      return;
    }

    saveStatusRef.current = status;
    setSaveStatus(status);
  }, []);

  React.useEffect(() => {
    activeBoardIdRef.current = activeBoardId;
    clearPendingSave();
    setSaveStatus("saved");
    saveStatusRef.current = "saved";
    saveVersionRef.current += 1;
    setError("");
    latestSceneRef.current = null;
    apiRef.current = null;
  }, [activeBoardId, clearPendingSave]);

  React.useEffect(() => {
    return clearPendingSave;
  }, [clearPendingSave]);

  const persistScene = React.useCallback(
    async (boardId: number, scene: LatestScene, saveVersion: number) => {
      const now = new Date().toISOString();
      const nextScene = {
        elements: scene.elements as unknown as Record<string, unknown>[],
        appState: sanitizeAppState(scene.appState),
        files: scene.files as unknown as Record<string, unknown>,
      };

      try {
        await saveWhiteboard(boardId, nextScene);
        if (saveVersionRef.current === saveVersion) {
          setLocalBoards((current) =>
            current.map((board) =>
              board.id === boardId
                ? {
                    ...board,
                    ...nextScene,
                    updatedAt: now,
                  }
                : board
            )
          );
        }

        if (activeBoardIdRef.current === boardId && saveVersionRef.current === saveVersion) {
          setSaveStatusSafely("saved");
        }
      } catch (caughtError) {
        if (activeBoardIdRef.current === boardId && saveVersionRef.current === saveVersion) {
          setSaveStatusSafely("error");
          setError(caughtError instanceof Error ? caughtError.message : "Unable to save whiteboard.");
        }
      }
    },
    [setSaveStatusSafely]
  );

  const scheduleSave = React.useCallback(
    (scene: LatestScene) => {
      const boardId = activeBoardIdRef.current;
      if (!boardId) {
        return;
      }

      latestSceneRef.current = scene;
      clearPendingSave();
      const saveVersion = saveVersionRef.current + 1;
      saveVersionRef.current = saveVersion;
      setSaveStatusSafely("saving");
      saveTimeoutRef.current = window.setTimeout(() => {
        saveTimeoutRef.current = null;
        const nextScene = latestSceneRef.current;
        if (nextScene) {
          void persistScene(boardId, nextScene, saveVersion);
        }
      }, 900);
    },
    [clearPendingSave, persistScene, setSaveStatusSafely]
  );

  const handleExcalidrawApi = React.useCallback((api: ExcalidrawApi) => {
    apiRef.current = api;
  }, []);

  const handleExcalidrawChange = React.useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      scheduleSave({ elements, appState, files });
    },
    [scheduleSave]
  );

  const excalidrawInitialData = React.useMemo(
    () =>
      selectedBoard
        ? {
            elements: selectedBoard.elements as never,
            appState: {
              ...defaultAppState,
              ...selectedBoard.appState,
              name: selectedBoard.name,
            },
            files: selectedBoard.files as never,
          }
        : null,
    [selectedBoard]
  );

  const excalidrawUiOptions = React.useMemo(
    () => ({
      canvasActions: {
        saveToActiveFile: false,
        loadScene: false,
        export: false as const,
        saveAsImage: false,
        toggleTheme: false,
      },
      tools: { image: true },
    }),
    []
  );

  function refresh() {
    router.refresh();
  }

  function updateCurrentColors(next: Partial<{ stroke: string; background: string; canvas: string }>) {
    const api = apiRef.current;
    if (!api) {
      return;
    }

    const appStatePatch: Partial<AppState> = {
        ...(next.stroke ? { currentItemStrokeColor: next.stroke } : {}),
        ...(next.background ? { currentItemBackgroundColor: next.background } : {}),
        ...(next.canvas ? { viewBackgroundColor: next.canvas } : {}),
    };

    api.updateScene({ appState: appStatePatch as never });
  }

  function addBoard() {
    startTransition(async () => {
      try {
        const boardNumber = localBoards.length + 1;
        const color = boardColors[boardNumber % boardColors.length].value as "teal" | "sky" | "rose" | "amber" | "emerald" | "violet" | "slate";
        const boardId = await createWhiteboard(`Whiteboard ${boardNumber}`, color);
        setSelectedBoardId(boardId);
        refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to create whiteboard.");
      }
    });
  }

  function renameBoard(board: WhiteboardView) {
    const nextName = window.prompt("Rename whiteboard", board.name);
    if (nextName === null) {
      return;
    }

    const name = nextName.trim() || "Untitled whiteboard";
    setLocalBoards((current) => current.map((item) => (item.id === board.id ? { ...item, name, updatedAt: new Date().toISOString() } : item)));
    startTransition(async () => {
      try {
        await renameWhiteboard(board.id, name);
        refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to rename whiteboard.");
      }
    });
  }

  function removeBoard(boardId: number) {
    const board = localBoards.find((item) => item.id === boardId);
    if (!board || !window.confirm(`Delete "${board.name}"? This cannot be undone.`)) {
      return;
    }

    const nextBoardId = localBoards.find((item) => item.id !== boardId)?.id ?? null;
    setLocalBoards((current) => current.filter((item) => item.id !== boardId));
    setSelectedBoardId(nextBoardId);
    startTransition(async () => {
      try {
        await deleteWhiteboard(boardId);
        refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to delete whiteboard.");
      }
    });
  }

  async function addStickyNote() {
    const api = apiRef.current;
    if (!api) {
      return;
    }

    const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
    const appState = api.getAppState();
    const x = -appState.scrollX + 120;
    const y = -appState.scrollY + 120;
    const elements = convertToExcalidrawElements(
      [
        {
          type: "rectangle",
          x,
          y,
          width: 220,
          height: 150,
          strokeColor: "#f59e0b",
          backgroundColor: stickyColor,
          fillStyle: "solid",
          roughness: 1,
          label: {
            text: "Sticky note",
            fontSize: 20,
            strokeColor: textColor,
            textAlign: "center",
            verticalAlign: "middle",
          },
        },
      ],
      { regenerateIds: true }
    );

    api.updateScene({ elements: [...api.getSceneElementsIncludingDeleted(), ...elements] });
    api.scrollToContent(elements);
  }

  async function insertAiDiagram() {
    const api = apiRef.current;
    if (!api) {
      return;
    }

    setAiPending(true);
    setError("");

    try {
      const spec = await generateDiagram(aiPrompt);
      const elements = await elementsForDiagram(spec, api.getAppState());
      api.updateScene({ elements: [...api.getSceneElementsIncludingDeleted(), ...elements] });
      api.scrollToContent(elements);
      setAiOpen(false);
      setAiPrompt("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to generate diagram.");
    } finally {
      setAiPending(false);
    }
  }

  async function exportPng() {
    const api = apiRef.current;
    if (!api || !selectedBoard) {
      return;
    }

    const { exportToBlob } = await import("@excalidraw/excalidraw");
    const blob = await exportToBlob({
      elements: api.getSceneElements() as never,
      appState: {
        ...api.getAppState(),
        exportBackground: true,
      },
      files: api.getFiles(),
      mimeType: "image/png",
      exportPadding: 24,
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = slugFileName(selectedBoard.name);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex min-w-0 flex-1 overflow-hidden">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[292px] translate-x-[-100%] flex-col border-r border-border/75 bg-card/98 p-3 shadow-xl shadow-slate-900/10 transition-transform lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
          panelOpen && "translate-x-0"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-muted-foreground">Whiteboards</p>
            <h1 className="truncate text-lg font-semibold text-foreground">{localBoards.length} boards</h1>
          </div>
          <Button className="h-8 w-8 rounded-lg" disabled={isPending} size="icon" onClick={addBoard}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">New whiteboard</span>
          </Button>
        </div>

        <Button className="mt-3 h-9 rounded-lg gap-2" disabled={isPending} onClick={addBoard}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New Whiteboard
        </Button>

        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {localBoards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
              Create a whiteboard to sketch, map ideas, and generate diagrams.
            </div>
          ) : (
            localBoards.map((board) => (
              <WhiteboardListItem
                key={board.id}
                active={board.id === selectedBoardId}
                board={board}
                onDelete={removeBoard}
                onRename={renameBoard}
                onSelect={(boardId) => {
                  setSelectedBoardId(boardId);
                  setPanelOpen(false);
                }}
              />
            ))
          )}
        </div>
      </aside>

      {panelOpen && <button className="fixed inset-0 z-20 bg-slate-950/20 lg:hidden" type="button" onClick={() => setPanelOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border/75 bg-background/80 px-3 backdrop-blur sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button className="h-9 w-9 rounded-lg lg:hidden" size="icon" variant="outline" onClick={() => setPanelOpen(true)}>
              <LayoutPanelLeft className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Open whiteboards</span>
            </Button>
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", selectedBoard ? colorFor(selectedBoard.color).dot : "bg-slate-300")} />
              <h2 className="truncate text-base font-semibold text-foreground">{selectedBoard?.name ?? "Whiteboard"}</h2>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "hidden h-8 items-center rounded-lg border px-2.5 text-xs font-bold sm:inline-flex",
                saveStatus === "saved" && "border-teal-100 bg-teal-50 text-teal-700",
                saveStatus === "saving" && "border-amber-100 bg-amber-50 text-amber-700",
                saveStatus === "error" && "border-rose-100 bg-rose-50 text-rose-700"
              )}
            >
              {saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving..." : "Save failed"}
            </span>
            <Button className="h-9 rounded-lg gap-2" disabled={!selectedBoard || aiPending} variant="outline" onClick={() => setAiOpen(true)}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">AI Diagram</span>
            </Button>
            <Button className="h-9 w-9 rounded-lg" disabled={!selectedBoard} size="icon" variant="outline" onClick={exportPng}>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Export PNG</span>
            </Button>
            <Button className="h-9 w-9 rounded-lg" size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">More options</span>
            </Button>
          </div>
        </header>

        {error && <p className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">{error}</p>}

        {selectedBoard ? (
          <div className="relative min-h-0 flex-1 bg-white">
            <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-lg border border-border bg-card/95 p-2 shadow-lg shadow-slate-900/10 backdrop-blur">
              <Button className="h-8 rounded-lg gap-2 px-2" size="sm" variant="outline" onClick={addStickyNote}>
                <StickyNote className="h-4 w-4" aria-hidden="true" />
                Sticky
              </Button>
              <ColorMenu icon={Pencil} label="Stroke color" options={colorPicks} value={strokeColor} onChange={(value) => {
                setStrokeColor(value);
                setTextColor(value);
                updateCurrentColors({ stroke: value });
              }} />
              <ColorMenu icon={Palette} label="Background color" options={backgroundPicks} value={backgroundColor} onChange={(value) => {
                setBackgroundColor(value);
                updateCurrentColors({ background: value });
              }} />
              <ColorMenu icon={FilePenLine} label="Text color" options={colorPicks} value={textColor} onChange={(value) => {
                setTextColor(value);
                updateCurrentColors({ stroke: value });
              }} />
              <ColorMenu icon={StickyNote} label="Sticky note color" options={stickyPicks} value={stickyColor} onChange={setStickyColor} />
              <ColorMenu icon={LayoutPanelLeft} label="Canvas color" options={canvasPicks} value={String(selectedBoard.appState.viewBackgroundColor ?? defaultAppState.viewBackgroundColor)} onChange={(value) => updateCurrentColors({ canvas: value })} />
            </div>

            <Excalidraw
              key={selectedBoard.id}
              excalidrawAPI={handleExcalidrawApi}
              initialData={excalidrawInitialData}
              name={selectedBoard.name}
              UIOptions={excalidrawUiOptions}
              onChange={handleExcalidrawChange}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <div className="max-w-sm text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <StickyNote className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-foreground">No whiteboard yet</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Create a board to start sketching, adding notes, and generating diagrams.</p>
              <Button className="mt-4 rounded-lg gap-2" onClick={addBoard}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Whiteboard
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Diagram Generator</DialogTitle>
            <DialogDescription>Describe a flowchart, mind map, system architecture, user journey, or process diagram.</DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-32 w-full resize-none rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
            placeholder="Example: Create a user onboarding flow from signup through activation and first project creation."
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
          />
          <DialogFooter>
            <Button disabled={aiPending} variant="outline" onClick={() => setAiOpen(false)}>
              Cancel
            </Button>
            <Button className="gap-2" disabled={aiPending || !aiPrompt.trim()} onClick={insertAiDiagram}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {aiPending ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function WhiteboardListItem({
  active,
  board,
  onDelete,
  onRename,
  onSelect,
}: {
  active: boolean;
  board: WhiteboardView;
  onDelete: (boardId: number) => void;
  onRename: (board: WhiteboardView) => void;
  onSelect: (boardId: number) => void;
}) {
  const color = colorFor(board.color);

  return (
    <div className={cn("group rounded-lg border transition", active ? "border-primary/25 bg-primary-soft/75" : "border-transparent hover:bg-accent/65")}>
      <div
        className="flex w-full min-w-0 cursor-pointer items-center gap-3 px-2 py-2 text-left"
        role="button"
        tabIndex={0}
        onClick={() => onSelect(board.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(board.id);
          }
        }}
      >
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", color.dot)} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{board.name}</span>
          <span className="mt-0.5 block truncate text-xs font-medium text-muted-foreground">Updated {formatUpdated(board.updatedAt)}</span>
        </span>
        <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-100 hover:bg-card hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100" type="button" onClick={(event) => {
          event.stopPropagation();
          onRename(board);
        }}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Rename whiteboard</span>
        </button>
        <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-100 hover:bg-card hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100" type="button" onClick={(event) => {
          event.stopPropagation();
          onDelete(board.id);
        }}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Delete whiteboard</span>
        </button>
      </div>
    </div>
  );
}

function ColorMenu({
  icon: Icon,
  label,
  onChange,
  options,
  value,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition hover:bg-accent hover:text-foreground"
        title={label}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <Icon className="h-4 w-4" aria-hidden={true} />
        <span className="sr-only">{label}</span>
      </button>
      <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-white" style={{ background: value }} />
      {open && (
        <div className="absolute left-0 top-10 z-20 grid w-[132px] grid-cols-4 gap-1 rounded-lg border border-border bg-card p-2 shadow-xl shadow-slate-900/10">
          {options.map((option) => (
            <button
              key={option}
              className={cn("h-7 rounded-md border border-border transition hover:scale-105", value === option && "ring-2 ring-primary/30")}
              title={option}
              type="button"
              style={{ background: option === "transparent" ? "linear-gradient(135deg,#fff 0 45%,#e5e7eb 45% 55%,#fff 55%)" : option }}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

async function elementsForDiagram(spec: DiagramSpec, appState: AppState) {
  const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
  const originX = -appState.scrollX + 160;
  const originY = -appState.scrollY + 170;
  const nodeIdBySpecId = new Map<string, string>();
  const skeletons: ExcalidrawElementSkeleton[] = [];

  spec.nodes.forEach((node, index) => {
    const id = `ai-${Date.now()}-${node.id}`;
    nodeIdBySpecId.set(node.id, id);
    const position = positionForNode(spec.layout, index, spec.nodes.length);
    skeletons.push({
      id,
      type: node.kind,
      x: originX + position.x,
      y: originY + position.y,
      width: node.kind === "ellipse" ? 190 : 210,
      height: node.kind === "diamond" ? 130 : 92,
      strokeColor: "#0f172a",
      backgroundColor: node.kind === "diamond" ? "#fef3c7" : "#e0f2fe",
      fillStyle: "solid",
      roughness: 1,
      label: {
        text: node.label,
        fontSize: 18,
        textAlign: "center",
        verticalAlign: "middle",
      },
    });
  });

  spec.edges.forEach((edge) => {
    const startId = nodeIdBySpecId.get(edge.from);
    const endId = nodeIdBySpecId.get(edge.to);
    if (!startId || !endId) {
      return;
    }

    skeletons.push({
      type: "arrow",
      x: originX,
      y: originY,
      strokeColor: "#334155",
      endArrowhead: "arrow",
      start: { id: startId },
      end: { id: endId },
      label: edge.label
        ? {
            text: edge.label,
            fontSize: 14,
            textAlign: "center",
            verticalAlign: "middle",
          }
        : undefined,
    });
  });

  return convertToExcalidrawElements(skeletons, { regenerateIds: false });
}

function positionForNode(layout: DiagramSpec["layout"], index: number, total: number) {
  if (layout === "mindmap") {
    if (index === 0) return { x: 0, y: 120 };
    const angle = ((index - 1) / Math.max(total - 1, 1)) * Math.PI * 2;
    return { x: Math.cos(angle) * 360 + 360, y: Math.sin(angle) * 190 + 120 };
  }

  if (layout === "architecture") {
    return { x: (index % 3) * 310, y: Math.floor(index / 3) * 170 };
  }

  if (layout === "journey") {
    return { x: index * 260, y: index % 2 === 0 ? 0 : 150 };
  }

  return { x: 0, y: index * 150 };
}
