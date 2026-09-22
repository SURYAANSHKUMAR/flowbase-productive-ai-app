# Flowbase Deployment

## Production Environment

Set `APP_MODE=cloud` and provide real values for:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `LIVEBLOCKS_SECRET_KEY`
- `OPENAI_API_KEY`
- `ASSEMBLYAI_API_KEY`

The app validates these values in cloud mode and fails fast when a required service is missing.

## Release Checklist

1. Install dependencies with `npm ci`.
2. Run `npm run lint`.
3. Run `npm run typecheck`.
4. Run `npm run test`.
5. Apply database migrations with `npx drizzle-kit push` or your hosted migration workflow.
6. Run `npm run build`.
7. Start with `npm run start`.
8. Smoke test sign-up, sign-in, dashboard, calendar, kanban, notes, pages/spaces, settings, whiteboard, AI assistant, AI template builder, Liveblocks auth, and AssemblyAI token generation.

## Local Mode

Set `APP_MODE=local` to use the local cookie session and `.flowbase-local-data.json`. Local mode is useful for demos and development, but production readiness is validated against cloud mode.
