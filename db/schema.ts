import { boolean, date, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const calendarItemType = pgEnum("calendar_item_type", ["task", "reminder"]);
export const calendarCategory = pgEnum("calendar_category", ["work", "personal", "focus"]);
export const kanbanTaskPriority = pgEnum("kanban_task_priority", ["low", "medium", "high"]);
export const workspacePageTemplate = pgEnum("workspace_page_template", ["blank", "project-plan", "meeting-notes", "prd", "research-notes", "task-plan"]);
export const categoryScope = pgEnum("category_scope", ["calendar", "task", "note", "reminder"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"),
  authorId: serial("author_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const calendarItems = pgTable("calendar_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  itemType: calendarItemType("item_type").notNull().default("task"),
  category: calendarCategory("category").notNull().default("work"),
  categoryId: integer("category_id").references(() => userCategories.id),
  scheduledDate: date("scheduled_date", { mode: "string" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanBoards = pgTable("kanban_boards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanColumns = pgTable("kanban_columns", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id")
    .notNull()
    .references(() => kanbanBoards.id),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanTasks = pgTable("kanban_tasks", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id")
    .notNull()
    .references(() => kanbanBoards.id),
  columnId: integer("column_id")
    .notNull()
    .references(() => kanbanColumns.id),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: date("due_date", { mode: "string" }),
  priority: kanbanTaskPriority("priority").notNull().default("medium"),
  categoryId: integer("category_id").references(() => userCategories.id),
  labels: jsonb("labels").$type<{ name: string; color: string }[]>().notNull().default([]),
  syncCalendar: boolean("sync_calendar").notNull().default(false),
  calendarItemId: integer("calendar_item_id").references(() => calendarItems.id),
  linkNotes: boolean("link_notes").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kanbanBoardShares = pgTable(
  "kanban_board_shares",
  {
    id: serial("id").primaryKey(),
    boardId: integer("board_id")
      .notNull()
      .references(() => kanbanBoards.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("kanban_board_shares_board_user_idx").on(table.boardId, table.userId)]
);

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  icon: text("icon").notNull().default("FileText"),
  color: text("color").notNull().default("amber"),
  categoryId: integer("category_id").references(() => userCategories.id),
  content: jsonb("content").$type<Record<string, unknown>>().notNull(),
  plainText: text("plain_text").notNull().default(""),
  wordCount: integer("word_count").notNull().default(0),
  isPinned: boolean("is_pinned").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whiteboards = pgTable("whiteboards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  color: text("color").notNull().default("teal"),
  elements: jsonb("elements").$type<Record<string, unknown>[]>().notNull().default([]),
  appState: jsonb("app_state").$type<Record<string, unknown>>().notNull().default({}),
  files: jsonb("files").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiGeneratedApps = pgTable("ai_generated_apps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  appJson: jsonb("app_json").$type<Record<string, unknown>>().notNull(),
  isInSidebar: boolean("is_in_sidebar").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserProfileSettings = {
  displayName: string;
  avatarUrl: string;
};

export type UserSubscriptionSettings = {
  plan: string;
  status: string;
  renewalDate: string | null;
  usageLimit: string;
};

export type UserPreferenceSettings = {
  theme: "system" | "light" | "dark";
  defaultCalendarView: "month" | "week";
  defaultTaskPriority: "low" | "medium" | "high";
  autoSave: boolean;
};

export type UserNotificationSettings = {
  emailNotifications: boolean;
  taskReminders: boolean;
  calendarDigest: boolean;
  aiUpdates: boolean;
};

export type UserAiSettings = {
  preferredModel: string;
  defaultBehavior: string;
  tone: string;
  aiRefine: boolean;
  aiAssistant: boolean;
  aiTemplateBuilder: boolean;
  aiDiagram: boolean;
};

export type UserPrivacySettings = {
  profileVisibility: "private" | "workspace";
  activityTracking: boolean;
  twoFactorReminder: boolean;
  dataRetention: "standard" | "minimal";
};

export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id)
    .unique(),
  profile: jsonb("profile").$type<UserProfileSettings>().notNull(),
  subscription: jsonb("subscription").$type<UserSubscriptionSettings>().notNull(),
  preferences: jsonb("preferences").$type<UserPreferenceSettings>().notNull(),
  notifications: jsonb("notifications").$type<UserNotificationSettings>().notNull(),
  ai: jsonb("ai").$type<UserAiSettings>().notNull(),
  privacy: jsonb("privacy").$type<UserPrivacySettings>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userCategories = pgTable("user_categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  scope: categoryScope("scope").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  icon: text("icon").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const spaces = pgTable("spaces", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("violet"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  members: jsonb("members").$type<{ initials: string; name: string; color: string }[]>().notNull().default([]),
  lastOpenedAt: timestamp("last_opened_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  spaceId: integer("space_id")
    .notNull()
    .references(() => spaces.id),
  name: text("name").notNull(),
  template: workspacePageTemplate("template").notNull().default("blank"),
  description: text("description").notNull().default(""),
  isFavorite: boolean("is_favorite").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  commentsCount: integer("comments_count").notNull().default(0),
  linkedTasksCount: integer("linked_tasks_count").notNull().default(0),
  lastEditedBy: text("last_edited_by").notNull().default(""),
  lastOpenedAt: timestamp("last_opened_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type CategoryScope = (typeof categoryScope.enumValues)[number];
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type UserCategory = typeof userCategories.$inferSelect;
export type NewUserCategory = typeof userCategories.$inferInsert;
export type CalendarItem = typeof calendarItems.$inferSelect;
export type NewCalendarItem = typeof calendarItems.$inferInsert;
export type KanbanBoard = typeof kanbanBoards.$inferSelect;
export type NewKanbanBoard = typeof kanbanBoards.$inferInsert;
export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type NewKanbanColumn = typeof kanbanColumns.$inferInsert;
export type KanbanTask = typeof kanbanTasks.$inferSelect;
export type NewKanbanTask = typeof kanbanTasks.$inferInsert;
export type KanbanBoardShare = typeof kanbanBoardShares.$inferSelect;
export type NewKanbanBoardShare = typeof kanbanBoardShares.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Whiteboard = typeof whiteboards.$inferSelect;
export type NewWhiteboard = typeof whiteboards.$inferInsert;
export type AiGeneratedApp = typeof aiGeneratedApps.$inferSelect;
export type NewAiGeneratedApp = typeof aiGeneratedApps.$inferInsert;
export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
