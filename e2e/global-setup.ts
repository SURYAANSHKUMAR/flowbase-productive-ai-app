import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const serverStatePath = path.resolve(process.cwd(), ".flowbase-e2e-server.json");

async function waitForServer() {
  const url = `http://127.0.0.1:${port}`;
  const startedAt = Date.now();

  while (Date.now() - startedAt < 60_000) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function globalSetup() {
  const localDataPath = process.env.FLOWBASE_LOCAL_DATA_PATH ?? ".flowbase-e2e-data.json";
  await rm(path.resolve(process.cwd(), localDataPath), { force: true });
  await rm(serverStatePath, { force: true });

  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        APP_MODE: "local",
        NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
        FLOWBASE_LOCAL_DATA_PATH: localDataPath,
      },
      stdio: "ignore",
      windowsHide: true,
    }
  );

  await writeFile(serverStatePath, JSON.stringify({ pid: server.pid }), "utf8");
  await waitForServer();
}

export default globalSetup;
