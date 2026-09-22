"use client";

import {
  Bell,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GripVertical,
  Plus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  type CalendarCategory,
  type CalendarItemType,
  createCalendarItem,
  moveCalendarItem,
  updateCalendarItem,
} from "@/app/calendar/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarItemView = {
  id: number;
  title: string;
  description: string | null;
  itemType: CalendarItemType;
  category: CalendarCategory;
  categoryId: number | null;
  scheduledDate: string | null;
};

export type CalendarCategoryView = {
  id: number;
  scope: "calendar" | "reminder";
  name: string;
  color: string;
  icon: string;
};

type CalendarViewMode = "month" | "week";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const categoryStyles: Record<
  CalendarCategory,
  {
    label: string;
    chip: string;
    dot: string;
    border: string;
  }
> = {
  work: {
    label: "Work",
    chip: "border-teal-100 bg-teal-50 text-teal-700",
    dot: "bg-teal-500",
    border: "border-l-teal-400",
  },
  personal: {
    label: "Personal",
    chip: "border-rose-100 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
    border: "border-l-rose-400",
  },
  focus: {
    label: "Focus",
    chip: "border-amber-100 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    border: "border-l-amber-400",
  },
};

const dynamicCategoryStyles: Record<string, { chip: string; dot: string; border: string }> = {
  teal: { chip: "border-teal-100 bg-teal-50 text-teal-700", dot: "bg-teal-500", border: "border-l-teal-400" },
  rose: { chip: "border-rose-100 bg-rose-50 text-rose-700", dot: "bg-rose-500", border: "border-l-rose-400" },
  amber: { chip: "border-amber-100 bg-amber-50 text-amber-700", dot: "bg-amber-500", border: "border-l-amber-400" },
  sky: { chip: "border-sky-100 bg-sky-50 text-sky-700", dot: "bg-sky-500", border: "border-l-sky-400" },
  emerald: { chip: "border-emerald-100 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", border: "border-l-emerald-400" },
  violet: { chip: "border-violet-100 bg-violet-50 text-violet-700", dot: "bg-violet-500", border: "border-l-violet-400" },
  slate: { chip: "border-slate-200 bg-slate-100 text-slate-700", dot: "bg-slate-500", border: "border-l-slate-400" },
};

function categoryMeta(item: CalendarItemView, categories: CalendarCategoryView[]) {
  const scope = item.itemType === "reminder" ? "reminder" : "calendar";
  const category = categories.find((current) => current.id === item.categoryId && current.scope === scope);
  const fallback = categoryStyles[item.category];
  const style = category ? dynamicCategoryStyles[category.color] ?? dynamicCategoryStyles.teal : fallback;
  return {
    label: category?.name ?? fallback.label,
    chip: style.chip,
    dot: style.dot,
    border: style.border,
  };
}

function dateToKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function keyToDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

function getMonthDays(anchorDate: Date) {
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const start = startOfWeek(firstOfMonth);
  const days: Date[] = [];

  for (let index = 0; index < 42; index += 1) {
    days.push(addDays(start, index));
  }

  return days;
}

function getWeekDays(anchorDate: Date) {
  const start = startOfWeek(anchorDate);

  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
}

function formatWeekRange(days: Date[]) {
  const formatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
  const first = days[0];
  const last = days[days.length - 1];

  return `${formatter.format(first)} - ${formatter.format(last)}, ${last.getFullYear()}`;
}

export function CalendarWorkspace({
  categories,
  defaultView,
  items,
}: {
  categories: CalendarCategoryView[];
  defaultView: CalendarViewMode;
  items: CalendarItemView[];
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>(defaultView);
  const [anchorDate, setAnchorDate] = React.useState(() => new Date());
  const [selectedDate, setSelectedDate] = React.useState(() => dateToKey(new Date()));
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<CalendarItemView | null>(null);
  const [pendingDropId, setPendingDropId] = React.useState<number | null>(null);
  const [error, setError] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const visibleDays = React.useMemo(
    () => (viewMode === "month" ? getMonthDays(anchorDate) : getWeekDays(keyToDate(selectedDate))),
    [anchorDate, selectedDate, viewMode]
  );

  const itemsByDate = React.useMemo(() => {
    const grouped = new Map<string, CalendarItemView[]>();

    items.forEach((item) => {
      if (!item.scheduledDate) {
        return;
      }

      const current = grouped.get(item.scheduledDate) ?? [];
      grouped.set(item.scheduledDate, [...current, item]);
    });

    return grouped;
  }, [items]);

  const draftItems = React.useMemo(() => items.filter((item) => !item.scheduledDate), [items]);

  function openCreateDialog(dateKey: string) {
    setError("");
    setEditingItem(null);
    setSelectedDate(dateKey);
    setDialogOpen(true);
  }

  function openEditDialog(item: CalendarItemView) {
    setError("");
    if (item.scheduledDate) {
      setSelectedDate(item.scheduledDate);
    }

    setEditingItem(item);
    setDialogOpen(true);
  }

  function movePeriod(direction: -1 | 1) {
    setAnchorDate((current) => {
      if (viewMode === "month") {
        return new Date(current.getFullYear(), current.getMonth() + direction, 1);
      }

      const next = addDays(keyToDate(selectedDate), direction * 7);
      setSelectedDate(dateToKey(next));
      return next;
    });
  }

  function handleDrop(event: React.DragEvent, dateKey: string) {
    event.preventDefault();
    const rawId = event.dataTransfer.getData("text/calendar-item-id");
    const itemId = Number(rawId);

    if (!itemId) {
      return;
    }

    setPendingDropId(itemId);
    startTransition(async () => {
      try {
        setError("");
        await moveCalendarItem(itemId, dateKey);
        router.refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to move calendar item.");
      } finally {
        setPendingDropId(null);
      }
    });
  }

  const title = viewMode === "month" ? formatMonthLabel(anchorDate) : formatWeekRange(visibleDays);

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/75 bg-background/70 px-4 py-4 backdrop-blur sm:px-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Calendar</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border/75 bg-card/90 p-1">
            {(["month", "week"] as const).map((mode) => (
              <button
                key={mode}
                className={cn(
                  "h-8 rounded-md px-3 text-sm font-semibold capitalize text-muted-foreground transition-colors",
                  viewMode === mode && "bg-primary text-primary-foreground shadow-sm shadow-teal-900/10"
                )}
                type="button"
                onClick={() => setViewMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <Button className="h-9 w-9 rounded-lg" size="icon" variant="outline" onClick={() => movePeriod(-1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Previous {viewMode}</span>
          </Button>
          <Button className="h-9 w-9 rounded-lg" size="icon" variant="outline" onClick={() => movePeriod(1)}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Next {viewMode}</span>
          </Button>
          <Button className="h-9 rounded-lg gap-2" onClick={() => openCreateDialog(selectedDate)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New task
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_320px] sm:px-6">
        <div className="min-w-0 rounded-lg border border-border/75 bg-card/95 p-3 shadow-sm shadow-slate-900/[0.025] sm:p-4">
          {error && <p className="mb-3 rounded-lg border border-destructive/20 bg-red-50 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
          <div className="grid grid-cols-7 border-b border-border/75 pb-2">
            {weekdayLabels.map((day) => (
              <div key={day} className="px-1 text-center text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          <div className={cn("mt-3 grid grid-cols-7 gap-2", viewMode === "week" ? "min-h-[540px]" : "min-h-[620px]")}>
            {visibleDays.map((day) => {
              const dateKey = dateToKey(day);
              const dayItems = itemsByDate.get(dateKey) ?? [];
              const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
              const isToday = dateKey === dateToKey(new Date());
              const isSelected = dateKey === selectedDate;

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "group flex min-h-[112px] min-w-0 flex-col rounded-lg border border-border/70 bg-background/80 p-2 text-left transition-colors hover:border-primary/50 hover:bg-accent/55",
                    viewMode === "week" && "min-h-[480px]",
                    !isCurrentMonth && viewMode === "month" && "bg-muted/45 text-muted-foreground",
                    isSelected && "border-primary/70 bg-primary-soft/55",
                    isPending && pendingDropId && "cursor-wait"
                  )}
                  role="button"
                  tabIndex={0}
                  onClick={() => openCreateDialog(dateKey)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openCreateDialog(dateKey);
                    }
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, dateKey)}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md text-sm font-semibold",
                        isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>

                  <span className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                    {dayItems.slice(0, viewMode === "week" ? 8 : 3).map((item) => (
                      <CalendarItemCard
                        key={item.id}
                        categories={categories}
                        item={item}
                        compact={viewMode === "month"}
                        onOpen={() => openEditDialog(item)}
                      />
                    ))}
                    {dayItems.length > (viewMode === "week" ? 8 : 3) && (
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                        +{dayItems.length - (viewMode === "week" ? 8 : 3)} more
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <DraftTaskPanel
          items={draftItems}
          categories={categories}
          onCreateDraft={() => {
            setEditingItem(null);
            setDialogOpen(true);
          }}
          onOpenItem={openEditDialog}
        />
      </div>

      {dialogOpen && (
        <CreateItemDialog
          item={editingItem}
          categories={categories}
          selectedDate={selectedDate}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            setEditingItem(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

function CalendarItemCard({
  categories,
  item,
  compact = false,
  onOpen,
}: {
  categories: CalendarCategoryView[];
  item: CalendarItemView;
  compact?: boolean;
  onOpen: () => void;
}) {
  const style = categoryMeta(item, categories);
  const Icon = item.itemType === "reminder" ? Bell : ClipboardList;

  function handleDragStart(event: React.DragEvent) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/calendar-item-id", String(item.id));
    event.dataTransfer.setData("text/calendar-item-source", item.scheduledDate ? "calendar" : "draft");
  }

  return (
    <span
      className={cn(
        "block cursor-grab rounded-md border border-border/70 border-l-4 bg-card px-2 py-1.5 text-xs shadow-sm transition-shadow active:cursor-grabbing",
        style.border
      )}
      draggable
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      onDragStart={handleDragStart}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate font-semibold text-foreground">{item.title}</span>
      </span>
      {!compact && item.description && <span className="mt-1 block line-clamp-2 text-muted-foreground">{item.description}</span>}
      <span className={cn("mt-1 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-semibold", style.chip)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
        {style.label}
      </span>
    </span>
  );
}

function DraftTaskPanel({
  categories,
  items,
  onCreateDraft,
  onOpenItem,
}: {
  categories: CalendarCategoryView[];
  items: CalendarItemView[];
  onCreateDraft: () => void;
  onOpenItem: (item: CalendarItemView) => void;
}) {
  return (
    <aside className="min-w-0 rounded-lg border border-border/75 bg-card/95 p-4 shadow-sm shadow-slate-900/[0.025]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Draft Task Panel</p>
          <h2 className="mt-1 text-base font-semibold text-card-foreground">Unscheduled ideas</h2>
        </div>
        <Button className="h-8 w-8 rounded-lg" size="icon" variant="outline" onClick={onCreateDraft}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Add draft</span>
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
            Save a task as draft, then drag it onto any calendar date when it is ready.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start gap-2">
              <GripVertical className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <CalendarItemCard categories={categories} item={item} onOpen={() => onOpenItem(item)} />
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function CreateItemDialog({
  categories,
  item,
  selectedDate,
  onClose,
  onSaved,
}: {
  categories: CalendarCategoryView[];
  item: CalendarItemView | null;
  selectedDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(item);
  const [title, setTitle] = React.useState(item?.title ?? "");
  const [description, setDescription] = React.useState(item?.description ?? "");
  const [itemType, setItemType] = React.useState<CalendarItemType>(item?.itemType ?? "task");
  const [category, setCategory] = React.useState<CalendarCategory>(item?.category ?? "work");
  const [categoryId, setCategoryId] = React.useState<number | null>(item?.categoryId ?? null);
  const [error, setError] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  function saveItem(scheduledDate: string | null) {
    setError("");
    startTransition(async () => {
      try {
        const input = {
          title,
          description,
          itemType,
          category,
          categoryId,
          scheduledDate,
        };

        if (item) {
          await updateCalendarItem(item.id, input);
        } else {
          await createCalendarItem(input);
        }

        onSaved();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to save item.");
      }
    });
  }

  const scopedCategories = categories.filter((current) => current.scope === (itemType === "reminder" ? "reminder" : "calendar"));
  const selectedCategoryId = categoryId && scopedCategories.some((current) => current.id === categoryId) ? categoryId : scopedCategories[0]?.id ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl shadow-slate-900/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {isEditing ? (item?.scheduledDate ? `Scheduled for ${item.scheduledDate}` : "Saved as draft") : `Create for ${selectedDate}`}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-card-foreground">
              {isEditing ? "Edit task or reminder" : "New task or reminder"}
            </h2>
          </div>
          <Button className="h-8 w-8 rounded-lg" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Close dialog</span>
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-foreground">Title</span>
            <input
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Plan launch notes"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-foreground">Description</span>
            <textarea
              className="mt-1 min-h-24 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Add a short note or reminder detail"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Type</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(["task", "reminder"] as const).map((type) => (
                  <button
                    key={type}
                    className={cn(
                      "h-10 rounded-lg border border-input bg-background text-sm font-semibold capitalize transition-colors hover:bg-accent",
                      itemType === type && "border-primary bg-primary-soft text-primary"
                    )}
                    type="button"
                    onClick={() => {
                      setItemType(type);
                      setCategoryId(categories.find((current) => current.scope === (type === "reminder" ? "reminder" : "calendar"))?.id ?? null);
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground">Category</p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {scopedCategories.map((currentCategory) => {
                  const style = dynamicCategoryStyles[currentCategory.color] ?? dynamicCategoryStyles.teal;

                  return (
                    <button
                      key={currentCategory.id}
                      className={cn(
                        "h-10 rounded-lg border bg-background px-2 text-xs font-semibold transition-colors",
                        style.chip,
                        selectedCategoryId === currentCategory.id && "ring-2 ring-primary/25"
                      )}
                      type="button"
                      onClick={() => {
                        setCategoryId(currentCategory.id);
                        const name = currentCategory.name.toLowerCase();
                        setCategory(name.includes("personal") ? "personal" : name.includes("focus") ? "focus" : "work");
                      }}
                    >
                      {currentCategory.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {error && <p className="rounded-lg border border-destructive/20 bg-red-50 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button className="rounded-lg" disabled={isPending} variant="outline" onClick={() => saveItem(null)}>
            {isEditing ? "Move to draft" : "Save draft"}
          </Button>
          <Button className="rounded-lg" disabled={isPending} onClick={() => saveItem(selectedDate)}>
            {isEditing ? "Save changes" : "Save to date"}
          </Button>
        </div>
      </div>
    </div>
  );
}
