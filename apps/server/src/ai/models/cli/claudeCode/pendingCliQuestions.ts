/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */

/** Answer payload from frontend. */
export type CliQuestionAnswers = Record<string, string>;

type PendingEntry = {
  resolve: (answers: CliQuestionAnswers) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** In-process registry mapping sessionId:toolUseId → pending Promise resolve fn. */
const pending = new Map<string, PendingEntry>();

const TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟超时

function buildKey(sessionId: string, toolUseId: string): string {
  return `${sessionId}:${toolUseId}`;
}

/**
 * Register a pending AskUserQuestion call.
 * Returns a Promise that resolves when the frontend submits answers (or times out with empty answers).
 */
export function registerPendingCliQuestion(
  sessionId: string,
  toolUseId: string,
): Promise<CliQuestionAnswers> {
  const key = buildKey(sessionId, toolUseId);
  // 如果已存在（重复调用），先清理旧的
  const existing = pending.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    pending.delete(key);
    existing.resolve({});
  }
  return new Promise<CliQuestionAnswers>((resolve) => {
    const timer = setTimeout(() => {
      if (pending.has(key)) {
        pending.delete(key);
        resolve({});
      }
    }, TIMEOUT_MS);
    pending.set(key, { resolve, timer });
  });
}

/**
 * Resolve a pending question with user-submitted answers.
 * Returns true if a pending entry was found and resolved.
 */
export function resolvePendingCliQuestion(
  sessionId: string,
  toolUseId: string,
  answers: CliQuestionAnswers,
): boolean {
  const key = buildKey(sessionId, toolUseId);
  const entry = pending.get(key);
  if (!entry) return false;
  clearTimeout(entry.timer);
  pending.delete(key);
  entry.resolve(answers);
  return true;
}
