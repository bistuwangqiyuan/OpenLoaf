#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");

/**
 * Run a command and throw when it fails.
 */
function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status ?? "unknown"}`);
  }
}

/**
 * Ensure a file exists at the given path.
 */
function assertFileExists(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} not found at ${filePath}`);
  }
}

/**
 * Best-effort removal for build output directories.
 */
function removeDirSafe(dirPath) {
  try {
    rmSync(dirPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    console.warn(`Warning: failed to remove ${dirPath}. Delete it manually if needed.`);
    console.warn(String(error));
  }
}

/**
 * Resolve dotnet CLI path from PATH, DOTNET_ROOT, or common install locations.
 */
function resolveDotnetCommand() {
  const candidates = [
    process.env.DOTNET_ROOT ? join(process.env.DOTNET_ROOT, "dotnet") : null,
    "dotnet",
    "/usr/local/share/dotnet/dotnet",
    "/opt/homebrew/share/dotnet/dotnet",
    process.env.HOME ? join(process.env.HOME, ".dotnet", "dotnet") : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["--version"], { stdio: "pipe" });
    if (!result.error && result.status === 0) {
      return candidate;
    }
  }

  return null;
}

/**
 * Return true when the caller requires a successful helper build.
 */
function shouldRequireHelperBuild() {
  return process.env.OPENLOAF_REQUIRE_DOCX_SFDT_HELPER === "1";
}

/**
 * Skip helper build gracefully unless strict mode requires it.
 */
function skipHelperBuild(reason) {
  const message =
    `${reason}\n` +
    "Skip DOCX->SFDT helper build. Desktop will fall back to the legacy DOC viewer until a helper binary is provided.\n" +
    "Install .NET 8 SDK and rerun `pnpm --filter desktop run build:docx-sfdt-helper`, or set OPENLOAF_REQUIRE_DOCX_SFDT_HELPER=1 to make this a hard failure.";

  if (shouldRequireHelperBuild()) {
    throw new Error(message);
  }

  console.warn(message);
}

/**
 * Resolve the current helper target metadata.
 */
function resolveCurrentTarget() {
  const targetMap = {
    darwin: {
      arm64: { runtime: "osx-arm64", dir: "darwin-arm64", binary: "openloaf-docx-sfdt" },
      x64: { runtime: "osx-x64", dir: "darwin-x64", binary: "openloaf-docx-sfdt" },
    },
    win32: {
      arm64: { runtime: "win-arm64", dir: "win32-arm64", binary: "openloaf-docx-sfdt.exe" },
      x64: { runtime: "win-x64", dir: "win32-x64", binary: "openloaf-docx-sfdt.exe" },
    },
    linux: {
      arm64: { runtime: "linux-arm64", dir: "linux-arm64", binary: "openloaf-docx-sfdt" },
      x64: { runtime: "linux-x64", dir: "linux-x64", binary: "openloaf-docx-sfdt" },
    },
  };

  return targetMap[process.platform]?.[process.arch] ?? null;
}

/**
 * Build the current platform DOCX->SFDT helper via dotnet publish.
 */
function buildHelper() {
  const target = resolveCurrentTarget();
  if (!target) {
    console.log("Skip DOCX->SFDT helper build: unsupported platform or architecture.");
    return;
  }

  const projectPath = join(rootDir, "helpers", "docx-sfdt", "OpenLoafDocxSfdt.csproj");
  const publishDir = join(rootDir, "resources", "docx-sfdt", "publish", target.dir);
  const outputDir = join(rootDir, "resources", "docx-sfdt", target.dir);
  const outputBinary = join(outputDir, target.binary);
  const dotnetCommand = resolveDotnetCommand();

  assertFileExists(projectPath, "OpenLoafDocxSfdt.csproj");

  if (!dotnetCommand) {
    if (existsSync(outputBinary)) {
      console.warn(
        `dotnet CLI not found. Reuse existing DOCX->SFDT helper binary: ${outputBinary}`,
      );
      return;
    }

    skipHelperBuild("dotnet CLI not found in PATH.");
    return;
  }

  removeDirSafe(publishDir);
  mkdirSync(publishDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  runCommand(dotnetCommand, [
    "publish",
    projectPath,
    "-c",
    "Release",
    "-r",
    target.runtime,
    "--self-contained",
    "true",
    "/p:PublishSingleFile=true",
    "-o",
    publishDir,
  ]);

  const builtBinary = join(publishDir, target.binary);
  assertFileExists(builtBinary, "DOCX->SFDT helper binary");
  copyFileSync(builtBinary, outputBinary);

  if (process.platform !== "win32") {
    chmodSync(outputBinary, 0o755);
  }

  removeDirSafe(publishDir);
  console.log(`Built DOCX->SFDT helper: ${outputBinary}`);
}

/**
 * Entry point for building the DOCX->SFDT helper.
 */
function main() {
  buildHelper();
}

main();
