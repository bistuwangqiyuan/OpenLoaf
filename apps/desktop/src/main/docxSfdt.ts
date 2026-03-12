/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { getOpenLoafRootDir } from '@openloaf/config';
import type { Logger } from './logging/startupLogger';
import { isAbsoluteLocalPath, resolveLocalPath } from './resolveLocalPath';

type DocxToSfdtFailureCode =
  | 'unsupported'
  | 'helper_missing'
  | 'invalid_input'
  | 'file_not_found'
  | 'license_missing'
  | 'timeout'
  | 'parse_error'
  | 'convert_failed';

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

const DOCX_SFDT_TIMEOUT_MS = 60_000;

/** Read a simple KEY=VALUE env file from disk. */
function readEnvFile(filePath: string): Record<string, string> {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf-8');
    const env: Record<string, string> = {};

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
      const eq = normalized.indexOf('=');
      if (eq <= 0) continue;

      const key = normalized.slice(0, eq).trim();
      let value = normalized.slice(eq + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
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

/** Resolve the helper binary metadata for the current runtime. */
function resolveHelperTarget() {
  const targetMap = {
    darwin: {
      arm64: { dir: 'darwin-arm64', binary: 'openloaf-docx-sfdt' },
      x64: { dir: 'darwin-x64', binary: 'openloaf-docx-sfdt' },
    },
    win32: {
      arm64: { dir: 'win32-arm64', binary: 'openloaf-docx-sfdt.exe' },
      x64: { dir: 'win32-x64', binary: 'openloaf-docx-sfdt.exe' },
    },
    linux: {
      arm64: { dir: 'linux-arm64', binary: 'openloaf-docx-sfdt' },
      x64: { dir: 'linux-x64', binary: 'openloaf-docx-sfdt' },
    },
  } as const;

  return targetMap[process.platform as keyof typeof targetMap]?.[
    process.arch as keyof (typeof targetMap)['darwin']
  ] ?? null;
}

/** Resolve the packaged or dev helper path for the current runtime. */
function resolveDocxSfdtHelperPath(): string | null {
  const target = resolveHelperTarget();
  if (!target) return null;

  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'docx-sfdt', target.dir, target.binary);
  }

  const devRoot = path.resolve(__dirname, '../..');
  return path.join(devRoot, 'resources', 'docx-sfdt', target.dir, target.binary);
}

/** Resolve the helper process environment. */
function resolveHelperEnv(): NodeJS.ProcessEnv {
  if (app.isPackaged) {
    const openloafRoot = getOpenLoafRootDir();
    const userEnvPath = path.join(openloafRoot, '.env');
    const runtimeEnvPath = path.join(process.resourcesPath, 'runtime.env');
    return {
      ...process.env,
      ...readEnvFile(userEnvPath),
      ...readEnvFile(runtimeEnvPath),
      PATH: process.env.PATH,
    };
  }

  const devRoot = path.resolve(__dirname, '../..');
  const repoRoot = path.resolve(devRoot, '../..');
  return {
    ...process.env,
    // 中文注释：开发态优先读取仓库根目录 .env，方便本地直接复用 Web 的 Syncfusion key。
    ...readEnvFile(path.join(repoRoot, '.env')),
    ...readEnvFile(path.join(devRoot, 'resources', 'runtime.env')),
    PATH: process.env.PATH,
  };
}

/** Normalize helper failure code to the stable renderer-facing union. */
function normalizeFailureCode(code?: string): DocxToSfdtFailureCode {
  switch (code) {
    case 'unsupported':
      return 'unsupported';
    case 'helper_missing':
      return 'helper_missing';
    case 'invalid_input':
      return 'invalid_input';
    case 'file_not_found':
      return 'file_not_found';
    case 'license_missing':
      return 'license_missing';
    case 'timeout':
      return 'timeout';
    case 'parse_error':
      return 'parse_error';
    default:
      return 'convert_failed';
  }
}

/** Parse the helper stdout payload. */
function parseHelperOutput(stdout: string): HelperSuccessPayload | HelperFailurePayload | null {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : null;

  if (!lastLine) return null;
  try {
    return JSON.parse(lastLine) as HelperSuccessPayload | HelperFailurePayload;
  } catch {
    return null;
  }
}

/** Convert a local DOCX file to SFDT via the bundled helper. */
export async function convertDocxToSfdt(args: {
  uri: string;
  log: Logger;
}): Promise<DocxToSfdtResult> {
  const helperPath = resolveDocxSfdtHelperPath();
  if (!helperPath) {
    return {
      ok: false,
      reason: '当前平台暂不支持本地 DOCX 转换。',
      code: 'unsupported',
    };
  }

  if (!fs.existsSync(helperPath)) {
    return {
      ok: false,
      reason: 'DOCX 转换组件未构建，请先运行 pnpm --filter desktop run build:docx-sfdt-helper。',
      code: 'helper_missing',
    };
  }

  const inputPath = resolveLocalPath(args.uri);
  if (!inputPath || !isAbsoluteLocalPath(inputPath)) {
    return {
      ok: false,
      reason: '仅支持本地绝对路径或 file:// URI。',
      code: 'invalid_input',
    };
  }

  if (!fs.existsSync(inputPath)) {
    return {
      ok: false,
      reason: '未找到目标 DOCX 文件。',
      code: 'file_not_found',
    };
  }

  if (path.extname(inputPath).toLowerCase() !== '.docx') {
    return {
      ok: false,
      reason: '仅支持 .docx 文件。',
      code: 'invalid_input',
    };
  }

  return await new Promise<DocxToSfdtResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const finish = (result: DocxToSfdtResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
    };

    const child = spawn(helperPath, ['convert', JSON.stringify({ inputPath })], {
      env: resolveHelperEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // 中文注释：超时后 kill 失败不影响最终错误返回。
      }
      finish({
        ok: false,
        reason: 'DOCX 转换超时。',
        code: 'timeout',
      });
    }, DOCX_SFDT_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      args.log(`[docx-sfdt] helper spawn error: ${String(error)}`);
      finish({
        ok: false,
        reason: 'DOCX 转换组件启动失败。',
        code: 'convert_failed',
      });
    });

    child.on('close', (code) => {
      if (timedOut) return;
      if (stderr.trim()) {
        args.log(`[docx-sfdt] helper stderr: ${stderr.trim()}`);
      }

      const parsed = parseHelperOutput(stdout);
      if (parsed?.ok) {
        const sfdt = String(parsed.data?.sfdt ?? '').trim();
        if (!sfdt) {
          finish({
            ok: false,
            reason: 'DOCX 转换结果解析失败。',
            code: 'parse_error',
          });
          return;
        }
        finish({ ok: true, data: { sfdt } });
        return;
      }

      if (parsed && parsed.ok === false) {
        finish({
          ok: false,
          reason: String(parsed.reason ?? 'DOCX 转换失败。'),
          code: normalizeFailureCode(parsed.code),
        });
        return;
      }

      if (code === 0) {
        finish({
          ok: false,
          reason: 'DOCX 转换结果解析失败。',
          code: 'parse_error',
        });
        return;
      }

      finish({
        ok: false,
        reason: stderr.trim() || `DOCX helper exited with code ${code ?? 0}.`,
        code: 'convert_failed',
      });
    });
  });
}
