import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";
import { createServer } from "vite";

const require = createRequire(import.meta.url);
const electronCli = require.resolve("electron/cli.js");

let shuttingDown = false;
const children = [];
let viteServer = null;

function runBinary(binaryPath, args = []) {
  const child = spawn(binaryPath, args, {
    stdio: "inherit",
    shell: false,
  });
  children.push(child);
  return child;
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (viteServer) {
    await viteServer.close();
  }
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(exitCode);
}

async function main() {
  viteServer = await createServer({
    server: { port: 5173 }
  });
  await viteServer.listen();
  viteServer.printUrls();

  const electron = runBinary(process.execPath, [electronCli, "."]);
  electron.on("exit", (electronCode) => shutdown(electronCode ?? 0));
}

main().catch((error) => {
  console.error(error);
  shutdown(1);
});

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
