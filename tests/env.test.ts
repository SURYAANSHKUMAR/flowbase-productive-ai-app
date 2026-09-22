import { describe, expect, it } from "vitest";

import { assertConfigured, assertCloudConfig, missingCloudConfig } from "../lib/env";

describe("production environment validation", () => {
  it("does not require cloud services in local mode", () => {
    expect(missingCloudConfig({ APP_MODE: "local" })).toEqual([]);
  });

  it("reports placeholder cloud values", () => {
    const missing = missingCloudConfig({
      APP_MODE: "cloud",
      DATABASE_URL: "postgresql://placeholder-url",
      NEXT_PUBLIC_APP_URL: "https://flowbase.example",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_placeholder",
      CLERK_SECRET_KEY: "sk_test_real",
      LIVEBLOCKS_SECRET_KEY: "sk_prod_real",
      OPENAI_API_KEY: "sk-proj-real",
      ASSEMBLYAI_API_KEY: "assemblyai-real",
    });

    expect(missing).toEqual(["DATABASE_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]);
  });

  it("throws a helpful cloud-mode error", () => {
    expect(() => assertCloudConfig({ APP_MODE: "cloud" })).toThrow(/Cloud mode is missing required configuration/);
  });

  it("returns configured individual values", () => {
    expect(() => assertConfigured("OPENAI_API_KEY", { OPENAI_API_KEY: "sk-proj-real" })).not.toThrow();
    expect(() => assertConfigured("OPENAI_API_KEY", { OPENAI_API_KEY: "sk-proj-placeholder" })).toThrow("OPENAI_API_KEY is not configured.");
  });
});
