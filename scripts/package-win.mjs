import { readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const mode = process.argv[2] ?? "installer";
const localAppData = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
const outputDir = process.env.SUBPIX_WIN_OUTPUT_DIR || join(localAppData, "Subpix", "release");
const builderCliPath = join(process.cwd(), "node_modules", "electron-builder", "cli.js");
const isInstallerBuild = mode === "installer";
const isUnpackedBuild = mode === "unpacked";

if (!isInstallerBuild && !isUnpackedBuild) {
  console.error("Usage: node scripts/package-win.mjs <installer|unpacked>");
  process.exit(1);
}

await rm(outputDir, { force: true, recursive: true });

const target = isInstallerBuild ? "nsis" : "dir";
const builderArgs = [
  builderCliPath,
  "--win",
  target,
  "--x64",
  `--config.directories.output=${outputDir}`,
  "--config.win.signExecutable=false"
];

const builder = spawn(process.execPath, builderArgs, {
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
  stdio: "inherit"
});

const exitCode = await new Promise((resolve) => {
  builder.on("close", resolve);
});

if (exitCode !== 0) {
  process.exit(Number(exitCode) || 1);
}

const artifactPath = isInstallerBuild
  ? join(outputDir, `Subpix-Setup-${packageJson.version}-x64.exe`)
  : join(outputDir, "win-unpacked", "Subpix.exe");

console.log("");
console.log(`Subpix Windows ${isInstallerBuild ? "installer" : "desktop build"} created at: ${artifactPath}`);
console.log("Set SUBPIX_WIN_OUTPUT_DIR to choose a different output directory.");
