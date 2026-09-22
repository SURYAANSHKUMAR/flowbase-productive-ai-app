import {
  KanbanWorkspace,
  type KanbanBoardView,
  type KanbanCategoryView,
  type KanbanColumnView,
  type KanbanTaskView,
} from "@/app/kanban/workspace";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { isLiveblocksEnabled } from "@/lib/app-mode";
import { requireCurrentDbUser } from "@/lib/current-user";
import { getKanbanData, getSettingsForUser, listCategoriesForUser } from "@/lib/workspace-data";

export default async function KanbanPage() {
  const user = await requireCurrentDbUser();
  const [{ boards, collaboratorsByBoard, columns, tasks }, categories, settings] = await Promise.all([getKanbanData(user), listCategoriesForUser(user.id), getSettingsForUser(user)]);

  const boardViews: KanbanBoardView[] = boards.map((board) => ({
    id: board.id,
    name: board.name,
    color: board.color,
    isOwner: board.userId === user.id,
    collaborators: collaboratorsByBoard.get(board.id) ?? [],
  }));

  const columnViews: KanbanColumnView[] = columns.map((column) => ({
    id: column.id,
    boardId: column.boardId,
    name: column.name,
    position: column.position,
  }));

  const taskViews: KanbanTaskView[] = tasks.map((task) => ({
    id: task.id,
    boardId: task.boardId,
    columnId: task.columnId,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    priority: task.priority,
    categoryId: task.categoryId,
    labels: task.labels,
    syncCalendar: task.syncCalendar,
    calendarItemId: task.calendarItemId,
    linkNotes: task.linkNotes,
    position: task.position,
  }));

  const categoryViews: KanbanCategoryView[] = categories
    .filter((category) => category.scope === "task")
    .map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
    }));

  return (
    <ProtectedAppShell>
      <KanbanWorkspace
        boards={boardViews}
        categories={categoryViews}
        collaborationEnabled={isLiveblocksEnabled()}
        columns={columnViews}
        currentUser={{
          id: user.id,
          name: user.name || user.email,
          email: user.email,
        }}
        defaultPriority={settings.preferences.defaultTaskPriority}
        tasks={taskViews}
      />
    </ProtectedAppShell>
  );
}
