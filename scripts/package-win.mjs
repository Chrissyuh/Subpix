import { rm } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

const outputDir = process.env.SUBPIX_WIN_OUTPUT_DIR || join(tmpdir(), "subpix-release");
const executablePath = join(outputDir, "win-unpacked", "Subpix.exe");
const builderCliPath = join(process.cwd(), "node_modules", "electron-builder", "cli.js");

await rm(outputDir, { force: true, recursive: true });

const builderArgs = [builderCliPath, "--win", "dir", `--config.directories.output=${outputDir}`];
const builder = spawn(process.execPath, builderArgs, {
  stdio: "inherit"
});

const exitCode = await new Promise((resolve) => {
  builder.on("close", resolve);
});

if (exitCode !== 0) {
  process.exit(Number(exitCode) || 1);
}

console.log("");
console.log(`Subpix Windows desktop build created at: ${executablePath}`);
console.log("Set SUBPIX_WIN_OUTPUT_DIR to choose a different output directory.");
