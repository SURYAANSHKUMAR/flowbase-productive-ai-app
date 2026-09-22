export type AiTemplateField = {
  label: string;
  type: "text" | "number" | "date" | "select" | "checkbox" | "textarea";
  placeholder?: string;
  options?: string[];
};

export type AiTemplateAction = {
  label: string;
  style?: "primary" | "secondary" | "outline";
};

export type AiTemplateComponent = {
  type: "stats" | "list" | "table" | "form" | "progress" | "checklist" | "buttons" | "tags" | "chart-placeholder";
  title: string;
  description?: string;
  fields?: AiTemplateField[];
  actions?: AiTemplateAction[];
  items?: Record<string, unknown>[];
};

export type AiTemplateSection = {
  title: string;
  description?: string;
  components: AiTemplateComponent[];
};

export type AiTemplateAppJson = {
  appName: string;
  description: string;
  icon: string;
  color: string;
  layout: "single-page";
  sections: AiTemplateSection[];
  components: AiTemplateComponent[];
  fields: AiTemplateField[];
  actions: AiTemplateAction[];
  sampleData: Record<string, unknown>[];
};

export type AiGeneratedAppView = {
  id: number;
  appJson: AiTemplateAppJson;
  isInSidebar: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SidebarGeneratedApp = {
  id: number;
  appName: string;
  description: string;
  icon: string;
  color: string;
};
