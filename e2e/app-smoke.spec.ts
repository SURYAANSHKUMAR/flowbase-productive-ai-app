import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(`smoke-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Build your workspace flow" })).toBeVisible();
});

test("dashboard shows live workspace entry points", async ({ page }) => {
  await expect(page.getByRole("link", { name: /New page/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start prompt/i }).first()).toHaveAttribute("href", "/ai-assistant");
  await expect(page.getByRole("heading", { name: "Workspace health" })).toBeVisible();
});

test("core protected routes render without runtime errors", async ({ page }) => {
  const routes = [
    ["/calendar", /Calendar/i],
    ["/kanban", /Kanban boards|Create a Kanban board/i],
    ["/notes", /Writing space/i],
    ["/whiteboard", /Whiteboards/i],
    ["/pages-spaces", /All Spaces/i],
    ["/settings", /Workspace preferences/i],
    ["/ai-assistant", /AI Assistant/i],
    ["/ai-template-builder", /Generate mini apps from a prompt/i],
  ] as const;

  for (const [route, visibleText] of routes) {
    await page.goto(route);
    await expect(page.getByText(visibleText).first()).toBeVisible();
  }
});

test("pages and spaces can create a space", async ({ page }) => {
  await page.goto("/pages-spaces");
  await page.locator("header").getByRole("button", { name: "New Space" }).click();
  await page.getByLabel("Space Name").fill("Smoke Space");
  await page.getByLabel("Description").fill("Created by the production smoke suite.");
  await page.getByRole("button", { name: "Create Space" }).click();
  await expect(page.getByRole("heading", { name: "Smoke Space" })).toBeVisible();
});

test("calendar can create a draft item", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByRole("button", { name: "New task" }).click();
  await page.getByPlaceholder("Plan launch notes").fill("Smoke calendar item");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Smoke calendar item")).toBeVisible();
});

test("kanban can create a board", async ({ page }) => {
  await page.goto("/kanban");
  await page.getByRole("button", { name: /Create board/i }).first().click();
  await page.getByPlaceholder("Launch plan").fill("Smoke Board");
  await page.getByRole("button", { name: "Create board" }).last().click();
  await expect(page.locator("h1", { hasText: "Smoke Board" })).toBeVisible();
});

test("notes exposes the creation workflow", async ({ page }) => {
  await page.goto("/notes");
  await expect(page.getByRole("button", { name: /New note/i }).first()).toBeVisible();
  await expect(page.getByText(/Saved|Writing space/i).first()).toBeVisible();
});

test("settings can save a profile change", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Display name").fill("Smoke User");
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect(page.getByText("Settings saved")).toBeVisible();
});

test("whiteboard exposes the creation workflow", async ({ page }) => {
  await page.goto("/whiteboard");
  await expect(page.getByRole("button", { name: /New Whiteboard/i }).first()).toBeVisible();
  await expect(page.getByText(/Whiteboards|No whiteboard yet/i).first()).toBeVisible();
});

test("AI assistant reports missing OpenAI configuration cleanly", async ({ page }) => {
  await page.goto("/ai-assistant");
  await page.getByPlaceholder("Ask AI to plan, write, summarize, or create something...").fill("Plan tomorrow");
  await page.getByRole("button", { name: "Send prompt" }).click();
  await expect(page.getByText("OPENAI_API_KEY is not configured.").first()).toBeVisible();
});
