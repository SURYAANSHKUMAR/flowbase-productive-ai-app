import { isLocalMode, isPlaceholder } from "@/lib/app-mode";

type AppEnv = Record<string, string | undefined>;

const cloudRequiredVariables = [
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "LIVEBLOCKS_SECRET_KEY",
  "OPENAI_API_KEY",
  "ASSEMBLYAI_API_KEY",
] as const;

export type CloudRequiredVariable = (typeof cloudRequiredVariables)[number];

export function missingCloudConfig(env: AppEnv = process.env) {
  if (isLocalMode(env)) {
    return [];
  }

  return cloudRequiredVariables.filter((name) => isPlaceholder(env[name]));
}

export function assertCloudConfig(env: AppEnv = process.env) {
  const missing = missingCloudConfig(env);

  if (missing.length > 0) {
    throw new Error(`Cloud mode is missing required configuration: ${missing.join(", ")}.`);
  }
}

export function assertConfigured(name: CloudRequiredVariable, env: AppEnv = process.env) {
  if (isPlaceholder(env[name])) {
    throw new Error(`${name} is not configured.`);
  }
}

export function configuredValue(name: CloudRequiredVariable, env: AppEnv = process.env) {
  assertConfigured(name, env);
  return env[name] as string;
}
