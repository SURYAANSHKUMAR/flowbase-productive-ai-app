import { readFile, rm } from "node:fs/promises";
import path from "node:path";

const serverStatePath = path.resolve(process.cwd(), ".flowbase-e2e-server.json");

async function globalTeardown() {
  try {
    const state = JSON.parse(await readFile(serverStatePath, "utf8")) as { pid?: number };
    if (state.pid) {
      process.kill(state.pid);
    }
  } catch {
    // The server may already be gone after a failed startup.
  } finally {
    await rm(serverStatePath, { force: true });
  }
}

export default globalTeardown;
