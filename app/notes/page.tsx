import { NotesWorkspace, type NoteCategoryView, type NoteView } from "@/app/notes/workspace";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { requireCurrentDbUser } from "@/lib/current-user";
import { listCategoriesForUser, listNotes } from "@/lib/workspace-data";

export default async function NotesPage() {
  const user = await requireCurrentDbUser();
  const [noteRows, categories] = await Promise.all([listNotes(user.id), listCategoriesForUser(user.id)]);

  const noteViews: NoteView[] = noteRows.map((note) => ({
    id: note.id,
    title: note.title,
    icon: note.icon,
    color: note.color,
    categoryId: note.categoryId,
    content: note.content,
    plainText: note.plainText,
    wordCount: note.wordCount,
    isPinned: note.isPinned,
    isDeleted: note.isDeleted,
    deletedAt: note.deletedAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }));

  const categoryViews: NoteCategoryView[] = categories
    .filter((category) => category.scope === "note")
    .map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
    }));

  return (
    <ProtectedAppShell>
      <NotesWorkspace categories={categoryViews} notes={noteViews} />
    </ProtectedAppShell>
  );
}
