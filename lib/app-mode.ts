export function isPlaceholder(value: string | undefined) {
  return !value || /placeholder|your_password/i.test(value);
}

export function isLocalMode(env: NodeJS.ProcessEnv | { APP_MODE?: string } = process.env) {
  return env.APP_MODE !== "cloud";
}

export function isLiveblocksEnabled() {
  return !isLocalMode() && !isPlaceholder(process.env.LIVEBLOCKS_SECRET_KEY);
}

export function isDatabaseConfigured() {
  return !isPlaceholder(process.env.DATABASE_URL);
}

export const localSessionCookie = "flowbase_local_user_id";
