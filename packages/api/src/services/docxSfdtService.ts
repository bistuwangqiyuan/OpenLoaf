import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type DocxToSfdtFailureCode =
  | "unsupported"
  | "helper_missing"
  | "invalid_input"
  | "file_not_found"
  | "license_missing"
  | "timeout"
  | "parse_error"
  | "convert_failed";

export type DocxToSfdtResult =
  | { ok: true; data: { sfdt: string } }
  | { ok: false; reason: string; code: DocxToSfdtFailureCode };

type HelperSuccessPayload = {
  ok: true;
  data?: {
    sfdt?: string;
  };
};

type HelperFailurePayload = {
  ok: false;
  reason?: string;
  code?: string;
};

type HelperTarget = {
  dir: string;
  binary: string;
};

const DOCX_SFDT_TIMEOUT_MS = 60_000;

/** Find the monorepo root by walking up from the current working directory. */
function findRepoRoot(startDir: string): string | null {
  let current = startDir;
  for (let i = 0; i < 12; i += 1) {
    if (
      existsSync(path.join(current, "pnpm-workspace.yaml")) &&
      existsSync(path.join(current, "turbo.json"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/** Read a simple KEY=VALUE env file into an object. */
function readEnvFile(filePath: string): Record<string, string> {
  try {
    if (!existsSync(filePath)) return {};
    const raw = readFileSync(filePath, "utf-8");
    const env: Record<string, string> = {};

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const normalized = trimmed.startsWith("export ")
        ? trimmed.slice(7).trim()
        : trimmed;
      const eq = normalized.indexOf("=");
      if (eq <= 0) continue;

      const key = normalized.slice(0, eq).trim();
      let value = normalized.slice(eq + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key) env[key] = value;
    }

    return env;
  } catch {
    return {};
  }
}

/** Resolve helper binary metadata for the current platform and architecture. */
function resolveHelperTarget(): HelperTarget | null {
  const targetMap = {
    darwin: {
      arm64: { dir: "darwin-arm64", binary: "openloaf-docx-sfdt" },
      x64: { dir: "darwin-x64", binary: "openloaf-docx-sfdt" },
    },
    win32: {
      arm64: { dir: "win32-arm64", binary: "openloaf-docx-sfdt.exe" },
      x64: { dir: "win32-x64", binary: "openloaf-docx-sfdt.exe" },
    },
    linux: {
      arm64: { dir: "linux-arm64", binary: "openloaf-docx-sfdt" },
      x64: { dir: "linux-x64", binary: "openloaf-docx-sfdt" },
    },
  } as const;

  return targetMap[process.platform as keyof typeof targetMap]?.[
    process.arch as keyof (typeof targetMap)["darwin"]
  ] ?? null;
}

/** Resolve a helper path from a root directory that contains platform outputs. */
function resolveHelperPathFromRoot(rootDir: string, target: HelperTarget): string {
  return path.join(rootDir, target.dir, target.binary);
}

/** Resolve the expected helper binary path for the current runtime. */
function resolveDocxSfdtHelperPath(target: HelperTarget): string | null {
  const explicitPath = process.env.OPENLOAF_DOCX_SFDT_HELPER_PATH?.trim();
  if (explicitPath) return explicitPath;

  const helperRoot = process.env.OPENLOAF_DOCX_SFDT_HELPER_ROOT?.trim();
  if (helperRoot) {
    return resolveHelperPathFromRoot(helperRoot, target);
  }

  const runtimeResourcesPath = (
    process as NodeJS.Process & { resourcesPath?: string }
  ).resourcesPath;
  if (typeof runtimeResourcesPath === "string" && runtimeResourcesPath.trim()) {
    return resolveHelperPathFromRoot(
      path.join(runtimeResourcesPath, "docx-sfdt"),
      target,
    );
  }

  const repoRoot = findRepoRoot(process.cwd());
  if (!repoRoot) return null;
  return resolveHelperPathFromRoot(
    path.join(repoRoot, "apps", "desktop", "resources", "docx-sfdt"),
    target,
  );
}

/** Resolve the helper process environment with local .env fallbacks in development. */
function resolveHelperEnv(): NodeJS.ProcessEnv {
  const repoRoot = findRepoRoot(process.cwd());
  const repoEnv = repoRoot
    ? readEnvFile(path.join(repoRoot, ".env"))
    : {};
  const desktopRuntimeEnv = repoRoot
    ? readEnvFile(
        path.join(repoRoot, "apps", "desktop", "resources", "runtime.env"),
      )
    : {};

  return {
    ...desktopRuntimeEnv,
    ...repoEnv,
    ...process.env,
    // 中文注释：保留启动进程修复后的 PATH，避免 helper 丢失系统依赖查找路径。
    PATH: process.env.PATH,
  };
}

/** Normalize helper failure codes to the server-facing union. */
function normalizeFailureCode(code?: string): DocxToSfdtFailureCode {
  switch (code) {
    case "unsupported":
      return "unsupported";
    case "helper_missing":
      return "helper_missing";
    case "invalid_input":
      return "invalid_input";
    case "file_not_found":
      return "file_not_found";
    case "license_missing":
      return "license_missing";
    case "timeout":
      return "timeout";
    case "parse_error":
      return "parse_error";
    default:
      return "convert_failed";
  }
}

/** Parse the helper stdout payload and read the final JSON line. */
function parseHelperOutput(
  stdout: string,
): HelperSuccessPayload | HelperFailurePayload | null {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : null;

  if (!lastLine) return null;
  try {
    return JSON.parse(lastLine) as
      | HelperSuccessPayload
      | HelperFailurePayload;
  } catch {
    return null;
  }
}

/** Convert a DOCX file on disk to SFDT using the local helper process. */
export async function convertDocxFileToSfdt(args: {
  inputPath: string;
  log?: (message: string) => void;
}): Promise<DocxToSfdtResult> {
  const helperTarget = resolveHelperTarget();
  if (!helperTarget) {
    return {
      ok: false,
      reason: "当前平台暂不支持本地 DOCX 转换。",
      code: "unsupported",
    };
  }

  const helperPath = resolveDocxSfdtHelperPath(helperTarget);
  if (!helperPath || !existsSync(helperPath)) {
    return {
      ok: false,
      reason:
        "DOCX 转换组件未就绪，请先构建 helper，或为 server 配置 OPENLOAF_DOCX_SFDT_HELPER_PATH。",
      code: "helper_missing",
    };
  }

  const inputPath = args.inputPath.trim();
  if (!inputPath || !path.isAbsolute(inputPath)) {
    return {
      ok: false,
      reason: "仅支持本地绝对路径。",
      code: "invalid_input",
    };
  }

  if (!existsSync(inputPath)) {
    return {
      ok: false,
      reason: "未找到目标 DOCX 文件。",
      code: "file_not_found",
    };
  }

  if (path.extname(inputPath).toLowerCase() !== ".docx") {
    return {
      ok: false,
      reason: "仅支持 .docx 文件。",
      code: "invalid_input",
    };
  }

  return await new Promise<DocxToSfdtResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const finish = (result: DocxToSfdtResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
    };

    const child = spawn(
      helperPath,
      ["convert", JSON.stringify({ inputPath })],
      {
        env: resolveHelperEnv(),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    const timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // 中文注释：超时后 kill 失败不影响最终错误返回。
      }
      finish({
        ok: false,
        reason: "DOCX 转换超时。",
        code: "timeout",
      });
    }, DOCX_SFDT_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      args.log?.(`[docx-sfdt] helper spawn error: ${String(error)}`);
      finish({
        ok: false,
        reason: "无法启动 DOCX 转换组件。",
        code: "helper_missing",
      });
    });

    child.on("close", (code) => {
      if (timedOut) return;
      const stderrText = stderr.trim();
      if (stderrText) {
        args.log?.(`[docx-sfdt] helper stderr: ${stderrText}`);
      }

      const parsed = parseHelperOutput(stdout);
      if (!parsed) {
        finish({
          ok: false,
          reason:
            stderrText || `DOCX 转换输出解析失败（exit code: ${String(code ?? "unknown")}）。`,
          code: "parse_error",
        });
        return;
      }

      if (parsed.ok) {
        const sfdt = String(parsed.data?.sfdt ?? "").trim();
        if (!sfdt) {
          finish({
            ok: false,
            reason: "DOCX 转换未返回有效 SFDT。",
            code: "parse_error",
          });
          return;
        }
        finish({
          ok: true,
          data: { sfdt },
        });
        return;
      }

      finish({
        ok: false,
        reason: parsed.reason?.trim() || "DOCX 转换失败。",
        code: normalizeFailureCode(parsed.code),
      });
    });
  });
}
