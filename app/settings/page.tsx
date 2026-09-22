import { SettingsWorkspace, type SettingsCategoryView, type SettingsView } from "@/app/settings/workspace";
import { ProtectedAppShell } from "@/components/protected-app-shell";
import { requireCurrentDbUser } from "@/lib/current-user";
import { getSettingsForUser, listCategoriesForUser } from "@/lib/workspace-data";

export default async function SettingsPage() {
  const user = await requireCurrentDbUser();
  const [settings, categories] = await Promise.all([getSettingsForUser(user), listCategoriesForUser(user.id)]);

  const settingsView: SettingsView = {
    email: user.email,
    profile: settings.profile,
    subscription: settings.subscription,
    preferences: settings.preferences,
    notifications: settings.notifications,
    ai: settings.ai,
    privacy: settings.privacy,
  };

  const categoryViews: SettingsCategoryView[] = categories.map((category) => ({
    id: category.id,
    scope: category.scope,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));

  return (
    <ProtectedAppShell>
      <SettingsWorkspace categories={categoryViews} settings={settingsView} />
    </ProtectedAppShell>
  );
}
