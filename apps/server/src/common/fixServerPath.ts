/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * 修复 server 进程的 PATH 环境变量。
 *
 * 当 server 作为 Electron 子进程运行时（生产模式），继承的 PATH 可能不完整：
 * - macOS：GUI 应用不加载用户 shell 配置（.zshrc 等），缺少 Homebrew、npm 等路径
 * - Windows：Explorer 缓存的 PATH 可能不包含后来安装的工具
 *
 * 此函数通过读取用户 shell / 注册表的真实 PATH 来修复。
 * 应在 server 启动最早阶段调用（在任何 CLI 工具检测之前）。
 */

const DELIMITER = process.platform === "win32" ? ";" : ":";

/** 获取当前 PATH 目录集合。 */
function currentPathSet(): Set<string> {
  return new Set((process.env.PATH ?? "").split(DELIMITER).filter(Boolean));
}

/** 去重追加路径到 process.env.PATH。 */
function appendPaths(paths: string[]): void {
  const existing = currentPathSet();
  const toAdd = paths.filter((p) => p && !existing.has(p) && existsSync(p));
  if (toAdd.length === 0) return;
  const current = process.env.PATH ?? "";
  process.env.PATH = current
    ? `${current}${DELIMITER}${toAdd.join(DELIMITER)}`
    : toAdd.join(DELIMITER);
}

/** macOS/Linux：从 login shell 读取用户完整 PATH。 */
function readShellPath(): string | null {
  const shell = process.env.SHELL ?? "/bin/bash";
  // 先尝试交互式 login shell，再 fallback 到非交互式。
  for (const flags of ["-ilc", "-lc"]) {
    try {
      const result = execSync(`${shell} ${flags} 'echo -n "$PATH"'`, {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const trimmed = result.trim();
      if (trimmed) return trimmed;
    } catch {
      // 继续尝试下一种方式。
    }
  }
  return null;
}

/** Windows：从注册表读取最新 PATH（绕过 Explorer 缓存）。 */
function readWindowsRegistryPath(): string | null {
  try {
    const result = execSync(
      'powershell.exe -NoProfile -NonInteractive -Command "[Environment]::GetEnvironmentVariable(\'Path\', \'Machine\') + \';\' + [Environment]::GetEnvironmentVariable(\'Path\', \'User\')"',
      {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      },
    );
    return result.trim() || null;
  } catch {
    return null;
  }
}

/** Windows：动态扫描 Python 安装目录。 */
function scanWindowsPythonDirs(localAppData: string): string[] {
  const base = path.join(localAppData, "Programs", "Python");
  const dirs: string[] = [];
  try {
    if (!existsSync(base)) return dirs;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("Python")) continue;
      dirs.push(path.join(base, entry.name));
      dirs.push(path.join(base, entry.name, "Scripts"));
    }
  } catch {
    // 扫描失败不阻塞。
  }
  return dirs;
}

/** 获取平台特定的常用工具目录（硬编码后备）。 */
function platformFallbackPaths(): string[] {
  const home = os.homedir();
  const paths: string[] = [];

  if (process.platform === "darwin") {
    paths.push("/opt/homebrew/bin", "/opt/homebrew/sbin");
    paths.push("/usr/local/bin", "/usr/local/sbin");
    paths.push(`${home}/.local/bin`);
    paths.push(`${home}/.npm-global/bin`, `${home}/.npm/bin`);
    paths.push(`${home}/.nvm/current/bin`, `${home}/.fnm/aliases/default/bin`);
    paths.push(`${home}/.pnpm-global/bin`, `${home}/Library/pnpm`);
    paths.push(`${home}/.pyenv/bin`, `${home}/.pyenv/shims`);
    paths.push(`${home}/.cargo/bin`);
  }

  if (process.platform === "linux") {
    paths.push("/usr/local/bin", "/usr/local/sbin");
    paths.push(`${home}/.local/bin`);
    paths.push(`${home}/.npm-global/bin`, `${home}/.npm/bin`);
    paths.push(`${home}/.nvm/current/bin`, `${home}/.fnm/aliases/default/bin`);
    paths.push(`${home}/.pyenv/bin`, `${home}/.pyenv/shims`);
    paths.push(`${home}/.cargo/bin`);
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
    const localAppData = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
    paths.push(path.join(appData, "npm"));
    paths.push(path.join(localAppData, "pnpm"));
    paths.push(path.join(localAppData, "Microsoft", "WindowsApps"));
    paths.push(...scanWindowsPythonDirs(localAppData));
    paths.push(path.join(home, ".pyenv", "pyenv-win", "shims"));
    paths.push(path.join(home, "scoop", "shims"));
    paths.push(path.join(home, ".cargo", "bin"));
  }

  return paths;
}

/** 修复 server 进程的 PATH。在 server 启动最早阶段调用一次。 */
export function fixServerPath(): void {
  if (process.platform === "win32") {
    // Windows：从注册表读取最新 PATH。
    const registryPath = readWindowsRegistryPath();
    if (registryPath) {
      appendPaths(registryPath.split(";").filter(Boolean));
    }
  } else {
    // macOS/Linux：从 login shell 读取用户 PATH。
    const shellPath = readShellPath();
    if (shellPath) {
      appendPaths(shellPath.split(":").filter(Boolean));
    }
  }

  // 无论 shell/registry 是否成功，追加平台常见目录作为后备。
  appendPaths(platformFallbackPaths());
}
