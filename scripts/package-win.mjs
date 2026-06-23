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

if (isInstallerBuild && (!process.env.CSC_LINK || !process.env.CSC_KEY_PASSWORD)) {
  console.error("Signed Windows installer builds require CSC_LINK and CSC_KEY_PASSWORD.");
  console.error("Set CSC_LINK to a .pfx/.p12 path, URL, or base64 value, and CSC_KEY_PASSWORD to its password.");
  console.error("Use `npm run dist:win:unpacked` for a local unsigned desktop build.");
  process.exit(1);
}

await rm(outputDir, { force: true, recursive: true });

const target = isInstallerBuild ? "nsis" : "dir";
const builderArgs = [builderCliPath, "--win", target, "--x64", `--config.directories.output=${outputDir}`];
if (isUnpackedBuild) {
  builderArgs.push("--config.win.forceCodeSigning=false");
}

const builder = spawn(process.execPath, builderArgs, {
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

if (isInstallerBuild) {
  await verifyAuthenticodeSignature(artifactPath);
}

console.log("");
console.log(`Subpix Windows ${isInstallerBuild ? "installer" : "desktop build"} created at: ${artifactPath}`);
console.log("Set SUBPIX_WIN_OUTPUT_DIR to choose a different output directory.");

async function verifyAuthenticodeSignature(filePath) {
  const command = [
    "$signature = Get-AuthenticodeSignature -LiteralPath $env:SUBPIX_ARTIFACT_PATH",
    "if ($signature.Status -ne 'Valid') {",
    "  Write-Error \"Authenticode signature is $($signature.Status): $($signature.StatusMessage)\"",
    "  exit 1",
    "}",
    "Write-Host \"Authenticode signature valid: $($signature.SignerCertificate.Subject)\"",
    "$signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue",
    "if ($signtool) {",
    "  & $signtool.Source verify /pa $env:SUBPIX_ARTIFACT_PATH",
    "  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }",
    "}"
  ].join("; ");

  const verifier = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      env: { ...process.env, SUBPIX_ARTIFACT_PATH: filePath },
      stdio: "inherit"
    }
  );

  const verifierExitCode = await new Promise((resolve) => {
    verifier.on("close", resolve);
  });

  if (verifierExitCode !== 0) {
    process.exit(Number(verifierExitCode) || 1);
  }
}
