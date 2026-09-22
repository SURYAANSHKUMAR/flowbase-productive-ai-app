"use client";

import {
  ArrowDown,
  Bell,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Download,
  Equal,
  FileText,
  Flame,
  Heart,
  Layers3,
  Palette,
  Pencil,
  Plus,
  Save,
  Settings,
  Shield,
  Sparkles,
  Star,
  Tag,
  Target,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { useRouter } from "next/navigation";

import { createCategory, deleteCategory, exportSettingsData, saveSettingsPatch, updateCategory } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CategoryScope,
  UserAiSettings,
  UserNotificationSettings,
  UserPreferenceSettings,
  UserPrivacySettings,
  UserProfileSettings,
  UserSubscriptionSettings,
} from "@/db/schema";

export type SettingsView = {
  email: string;
  profile: UserProfileSettings;
  subscription: UserSubscriptionSettings;
  preferences: UserPreferenceSettings;
  notifications: UserNotificationSettings;
  ai: UserAiSettings;
  privacy: UserPrivacySettings;
};

export type SettingsCategoryView = {
  id: number;
  scope: CategoryScope;
  name: string;
  color: string;
  icon: string;
};

type SectionId = "profile" | "subscription" | "categories" | "ai" | "preferences" | "notifications" | "data" | "privacy";

const sections: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "subscription", label: "Subscription", icon: Star },
  { id: "categories", label: "Categories", icon: Tag },
  { id: "ai", label: "AI", icon: Sparkles },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "data", label: "Data", icon: Download },
  { id: "privacy", label: "Privacy", icon: Shield },
];

const scopeLabels: Record<CategoryScope, string> = {
  calendar: "Calendar events",
  task: "Tasks / Kanban",
  note: "Notes",
  reminder: "Reminders",
};

const colorOptions = ["teal", "sky", "rose", "amber", "emerald", "violet", "slate", "fuchsia", "indigo"];
const iconOptions = ["Briefcase", "Heart", "Target", "Bell", "ClipboardList", "FileText", "Flame", "Sparkles", "Tag", "CalendarDays", "Layers3", "Shield", "Star", "Zap", "ArrowDown", "Equal"];
const modelOptions = [
  { value: "", label: "Use app default" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 mini" },
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "gpt-5.4-codex", label: "GPT-5.4 Codex" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
];

const colorClass: Record<string, { dot: string; soft: string; border: string }> = {
  teal: { dot: "bg-teal-500", soft: "bg-teal-50 text-teal-700", border: "border-teal-200" },
  sky: { dot: "bg-sky-500", soft: "bg-sky-50 text-sky-700", border: "border-sky-200" },
  rose: { dot: "bg-rose-500", soft: "bg-rose-50 text-rose-700", border: "border-rose-200" },
  amber: { dot: "bg-amber-500", soft: "bg-amber-50 text-amber-700", border: "border-amber-200" },
  emerald: { dot: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-700", border: "border-emerald-200" },
  violet: { dot: "bg-violet-500", soft: "bg-violet-50 text-violet-700", border: "border-violet-200" },
  slate: { dot: "bg-slate-500", soft: "bg-slate-100 text-slate-700", border: "border-slate-200" },
  fuchsia: { dot: "bg-fuchsia-500", soft: "bg-fuchsia-50 text-fuchsia-700", border: "border-fuchsia-200" },
  indigo: { dot: "bg-indigo-500", soft: "bg-indigo-50 text-indigo-700", border: "border-indigo-200" },
};

const iconMap = { ArrowDown, Bell, Briefcase, CalendarDays, ClipboardList, Equal, FileText, Flame, Heart, Layers3, Shield, Sparkles, Star, Tag, Target, Zap };

export function SettingsWorkspace({ categories, settings }: { categories: SettingsCategoryView[]; settings: SettingsView }) {
  const router = useRouter();
  const [activeSection, setActiveSection] = React.useState<SectionId>("profile");
  const [localSettings, setLocalSettings] = React.useState(settings);
  const [localCategories, setLocalCategories] = React.useState(categories);
  const [categoryDraft, setCategoryDraft] = React.useState<{ id: number | null; scope: CategoryScope; name: string; color: string; icon: string }>({
    id: null,
    scope: "calendar",
    name: "",
    color: "teal",
    icon: "Tag",
  });
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => setLocalSettings(settings), [settings]);
  React.useEffect(() => setLocalCategories(categories), [categories]);

  function run(action: () => Promise<void>, success = "Saved") {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        await action();
        setMessage(success);
        router.refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to save settings.");
      }
    });
  }

  function patchSettings(patch: Partial<SettingsView>) {
    setLocalSettings((current) => ({ ...current, ...patch }));
  }

  function saveSection(section: Exclude<SectionId, "categories" | "data">) {
    const patch = { [section]: localSettings[section] };
    run(() => saveSettingsPatch(patch), "Settings saved");
  }

  function saveCategoryDraft() {
    const payload = {
      scope: categoryDraft.scope,
      name: categoryDraft.name,
      color: categoryDraft.color,
      icon: categoryDraft.icon,
    };
    run(
      async () => {
        if (categoryDraft.id) {
          await updateCategory(categoryDraft.id, payload);
        } else {
          await createCategory(payload);
        }
        setCategoryDraft({ id: null, scope: categoryDraft.scope, name: "", color: "teal", icon: "Tag" });
      },
      "Category saved"
    );
  }

  function removeCategory(categoryId: number) {
    run(() => deleteCategory(categoryId), "Category deleted");
  }

  function exportData() {
    run(async () => {
      const payload = await exportSettingsData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "flowbase-settings-export.json";
      link.click();
      URL.revokeObjectURL(url);
    }, "Export ready");
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/75 bg-background/70 px-4 py-4 backdrop-blur sm:px-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Settings</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">Workspace preferences</h1>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700">{message}</span>}
          {error && <span className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</span>}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-5 px-4 py-5 lg:grid-cols-[240px_minmax(0,1fr)] sm:px-6">
        <aside className="h-fit rounded-lg border border-border/75 bg-card/95 p-2 shadow-sm shadow-slate-900/[0.025]">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                className={cn(
                  "flex h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm font-semibold transition-colors hover:bg-accent/70",
                  activeSection === section.id && "bg-primary-soft text-foreground"
                )}
                type="button"
                onClick={() => setActiveSection(section.id)}
              >
                <Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />
                {section.label}
              </button>
            );
          })}
        </aside>

        <div className="min-w-0 space-y-5">
          {activeSection === "profile" && (
            <Panel title="Profile" icon={User} action={<SaveButton disabled={isPending} onClick={() => saveSection("profile")} />}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-teal-100 bg-primary-soft text-lg font-bold text-primary">
                  {localSettings.profile.avatarUrl ? (
                    <Image alt="" className="h-full w-full object-cover" height={64} src={localSettings.profile.avatarUrl} unoptimized width={64} />
                  ) : (
                    initials(localSettings.profile.displayName)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">{localSettings.profile.displayName}</p>
                  <p className="text-sm text-muted-foreground">{localSettings.email}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <TextField label="Display name" value={localSettings.profile.displayName} onChange={(displayName) => patchSettings({ profile: { ...localSettings.profile, displayName } })} />
                <TextField label="Avatar URL" value={localSettings.profile.avatarUrl} onChange={(avatarUrl) => patchSettings({ profile: { ...localSettings.profile, avatarUrl } })} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <QuietAction icon={Shield} label="Account security" />
                <QuietAction icon={Settings} label="Connected account" />
              </div>
            </Panel>
          )}

          {activeSection === "subscription" && (
            <Panel title="Subscription" icon={Star} action={<SaveButton disabled={isPending} onClick={() => saveSection("subscription")} />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Plan" value={localSettings.subscription.plan} onChange={(plan) => patchSettings({ subscription: { ...localSettings.subscription, plan } })} />
                <TextField label="Status" value={localSettings.subscription.status} onChange={(status) => patchSettings({ subscription: { ...localSettings.subscription, status } })} />
                <TextField label="Renewal date" type="date" value={localSettings.subscription.renewalDate ?? ""} onChange={(renewalDate) => patchSettings({ subscription: { ...localSettings.subscription, renewalDate: renewalDate || null } })} />
                <TextField label="Usage limits" value={localSettings.subscription.usageLimit} onChange={(usageLimit) => patchSettings({ subscription: { ...localSettings.subscription, usageLimit } })} />
              </div>
              <Button className="mt-5 rounded-lg gap-2" type="button">
                <Star className="h-4 w-4" aria-hidden="true" />
                {localSettings.subscription.plan.toLowerCase() === "free" ? "Upgrade Plan" : "Manage Subscription"}
              </Button>
            </Panel>
          )}

          {activeSection === "categories" && (
            <Panel title="Categories" icon={Tag} action={<Button className="rounded-lg gap-2" disabled={isPending || !categoryDraft.name.trim()} onClick={saveCategoryDraft}><Plus className="h-4 w-4" />{categoryDraft.id ? "Save" : "Add"}</Button>}>
              <div className="grid gap-3 lg:grid-cols-[150px_1fr_120px_150px]">
                <SelectField label="Section" value={categoryDraft.scope} options={Object.entries(scopeLabels).map(([value, label]) => ({ value, label }))} onChange={(scope) => setCategoryDraft((draft) => ({ ...draft, scope: scope as CategoryScope }))} />
                <TextField label="Category name" value={categoryDraft.name} onChange={(name) => setCategoryDraft((draft) => ({ ...draft, name }))} />
                <SelectField label="Color" value={categoryDraft.color} options={colorOptions.map((color) => ({ value: color, label: color }))} onChange={(color) => setCategoryDraft((draft) => ({ ...draft, color }))} />
                <SelectField label="Icon" value={categoryDraft.icon} options={iconOptions.map((icon) => ({ value: icon, label: icon }))} onChange={(icon) => setCategoryDraft((draft) => ({ ...draft, icon }))} />
              </div>
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {(Object.keys(scopeLabels) as CategoryScope[]).map((scope) => (
                  <div key={scope} className="rounded-lg border border-border/75 bg-background/75 p-3">
                    <h3 className="text-sm font-semibold text-foreground">{scopeLabels[scope]}</h3>
                    <div className="mt-3 space-y-2">
                      {localCategories.filter((category) => category.scope === scope).map((category) => (
                        <CategoryRow key={category.id} category={category} onDelete={removeCategory} onEdit={() => setCategoryDraft(category)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {activeSection === "ai" && (
            <Panel title="AI Settings" icon={Sparkles} action={<SaveButton disabled={isPending} onClick={() => saveSection("ai")} />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Preferred model" value={localSettings.ai.preferredModel} options={modelOptions} onChange={(preferredModel) => patchSettings({ ai: { ...localSettings.ai, preferredModel } })} />
                <TextField label="Tone / style" value={localSettings.ai.tone} onChange={(tone) => patchSettings({ ai: { ...localSettings.ai, tone } })} />
              </div>
              <TextArea label="Default AI behavior" value={localSettings.ai.defaultBehavior} onChange={(defaultBehavior) => patchSettings({ ai: { ...localSettings.ai, defaultBehavior } })} />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Toggle label="AI Refine" checked={localSettings.ai.aiRefine} onChange={(aiRefine) => patchSettings({ ai: { ...localSettings.ai, aiRefine } })} />
                <Toggle label="AI Assistant" checked={localSettings.ai.aiAssistant} onChange={(aiAssistant) => patchSettings({ ai: { ...localSettings.ai, aiAssistant } })} />
                <Toggle label="AI Template Builder" checked={localSettings.ai.aiTemplateBuilder} onChange={(aiTemplateBuilder) => patchSettings({ ai: { ...localSettings.ai, aiTemplateBuilder } })} />
                <Toggle label="AI Diagram / Whiteboard" checked={localSettings.ai.aiDiagram} onChange={(aiDiagram) => patchSettings({ ai: { ...localSettings.ai, aiDiagram } })} />
              </div>
            </Panel>
          )}

          {activeSection === "preferences" && (
            <Panel title="App Preferences" icon={Palette} action={<SaveButton disabled={isPending} onClick={() => saveSection("preferences")} />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Theme" value={localSettings.preferences.theme} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} onChange={(theme) => patchSettings({ preferences: { ...localSettings.preferences, theme: theme as UserPreferenceSettings["theme"] } })} />
                <SelectField label="Default calendar view" value={localSettings.preferences.defaultCalendarView} options={[{ value: "month", label: "Month" }, { value: "week", label: "Week" }]} onChange={(defaultCalendarView) => patchSettings({ preferences: { ...localSettings.preferences, defaultCalendarView: defaultCalendarView as UserPreferenceSettings["defaultCalendarView"] } })} />
                <SelectField label="Default task priority" value={localSettings.preferences.defaultTaskPriority} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} onChange={(defaultTaskPriority) => patchSettings({ preferences: { ...localSettings.preferences, defaultTaskPriority: defaultTaskPriority as UserPreferenceSettings["defaultTaskPriority"] } })} />
                <Toggle label="Auto-save" checked={localSettings.preferences.autoSave} onChange={(autoSave) => patchSettings({ preferences: { ...localSettings.preferences, autoSave } })} />
              </div>
            </Panel>
          )}

          {activeSection === "notifications" && (
            <Panel title="Notifications" icon={Bell} action={<SaveButton disabled={isPending} onClick={() => saveSection("notifications")} />}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle label="Email notifications" checked={localSettings.notifications.emailNotifications} onChange={(emailNotifications) => patchSettings({ notifications: { ...localSettings.notifications, emailNotifications } })} />
                <Toggle label="Task reminders" checked={localSettings.notifications.taskReminders} onChange={(taskReminders) => patchSettings({ notifications: { ...localSettings.notifications, taskReminders } })} />
                <Toggle label="Calendar digest" checked={localSettings.notifications.calendarDigest} onChange={(calendarDigest) => patchSettings({ notifications: { ...localSettings.notifications, calendarDigest } })} />
                <Toggle label="AI updates" checked={localSettings.notifications.aiUpdates} onChange={(aiUpdates) => patchSettings({ notifications: { ...localSettings.notifications, aiUpdates } })} />
              </div>
            </Panel>
          )}

          {activeSection === "data" && (
            <Panel title="Data Export" icon={Download}>
              <div className="rounded-lg border border-dashed border-border bg-background/75 p-4">
                <p className="text-sm font-semibold text-foreground">Settings and categories JSON</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Download your user-specific settings, AI preferences, privacy options, and managed categories.</p>
                <Button className="mt-4 rounded-lg gap-2" disabled={isPending} onClick={exportData}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export Data
                </Button>
              </div>
            </Panel>
          )}

          {activeSection === "privacy" && (
            <Panel title="Privacy & Security" icon={Shield} action={<SaveButton disabled={isPending} onClick={() => saveSection("privacy")} />}>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Profile visibility" value={localSettings.privacy.profileVisibility} options={[{ value: "private", label: "Private" }, { value: "workspace", label: "Workspace" }]} onChange={(profileVisibility) => patchSettings({ privacy: { ...localSettings.privacy, profileVisibility: profileVisibility as UserPrivacySettings["profileVisibility"] } })} />
                <SelectField label="Data retention" value={localSettings.privacy.dataRetention} options={[{ value: "standard", label: "Standard" }, { value: "minimal", label: "Minimal" }]} onChange={(dataRetention) => patchSettings({ privacy: { ...localSettings.privacy, dataRetention: dataRetention as UserPrivacySettings["dataRetention"] } })} />
                <Toggle label="Activity tracking" checked={localSettings.privacy.activityTracking} onChange={(activityTracking) => patchSettings({ privacy: { ...localSettings.privacy, activityTracking } })} />
                <Toggle label="Two-factor reminder" checked={localSettings.privacy.twoFactorReminder} onChange={(twoFactorReminder) => patchSettings({ privacy: { ...localSettings.privacy, twoFactorReminder } })} />
              </div>
            </Panel>
          )}
        </div>
      </div>
    </section>
  );
}

function Panel({ action, children, icon: Icon, title }: { action?: React.ReactNode; children: React.ReactNode; icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <section className="rounded-lg border border-border/75 bg-card/95 p-5 shadow-sm shadow-slate-900/[0.025]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TextField({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <input className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <textarea className="mt-1 min-h-24 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: { value: string; label: string }[]; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <select className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm capitalize outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border/75 bg-background/75 px-3 py-2 text-sm font-semibold text-foreground">
      {label}
      <input className="h-4 w-4 accent-teal-600" checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SaveButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button className="rounded-lg gap-2" disabled={disabled} onClick={onClick}>
      <Save className="h-4 w-4" aria-hidden="true" />
      Save
    </Button>
  );
}

function QuietAction({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button className="flex h-11 items-center gap-2 rounded-lg border border-border/75 bg-background/75 px-3 text-sm font-semibold text-foreground hover:bg-accent/70" type="button">
      <Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />
      {label}
    </button>
  );
}

function CategoryRow({ category, onDelete, onEdit }: { category: SettingsCategoryView; onDelete: (id: number) => void; onEdit: () => void }) {
  const Icon = iconMap[category.icon as keyof typeof iconMap] ?? Tag;
  const color = colorClass[category.color] ?? colorClass.teal;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/75 bg-card px-2 py-2">
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", color.soft, color.border)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{category.name}</span>
      <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" type="button" onClick={onEdit}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Edit {category.name}</span>
      </button>
      <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600" type="button" onClick={() => onDelete(category.id)}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Delete {category.name}</span>
      </button>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
