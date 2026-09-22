import { CalendarWorkspace, type CalendarCategoryView, type CalendarItemView } from "@/app/calendar/workspace";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { requireCurrentDbUser } from "@/lib/current-user";
import { getSettingsForUser, listCalendarItems, listCategoriesForUser } from "@/lib/workspace-data";

export default async function CalendarPage() {
  const user = await requireCurrentDbUser();
  const [items, categories, settings] = await Promise.all([listCalendarItems(user.id), listCategoriesForUser(user.id), getSettingsForUser(user)]);

  const calendarItemsView: CalendarItemView[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    itemType: item.itemType,
    category: item.category,
    categoryId: item.categoryId,
    scheduledDate: item.scheduledDate,
  }));

  const categoryViews: CalendarCategoryView[] = categories
    .filter((category): category is typeof category & { scope: "calendar" | "reminder" } => category.scope === "calendar" || category.scope === "reminder")
    .map((category) => ({
      id: category.id,
      scope: category.scope,
      name: category.name,
      color: category.color,
      icon: category.icon,
    }));

  return (
    <ProtectedAppShell>
      <CalendarWorkspace categories={categoryViews} defaultView={settings.preferences.defaultCalendarView} items={calendarItemsView} />
    </ProtectedAppShell>
  );
}
