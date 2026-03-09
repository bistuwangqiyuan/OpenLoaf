/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
const RANDOM_CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Create a board id with format: board_{yyyyMMdd}_{HHmmss}_{random8}. */
export function createBoardId(): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const timePart = `${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes(),
  ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const randomPart = buildRandomString(8);
  return `board_${datePart}_${timePart}_${randomPart}`;
}

/** Build a random suffix string. */
function buildRandomString(length: number): string {
  if (length <= 0) return "";
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => RANDOM_CHARSET[value % RANDOM_CHARSET.length]).join("");
  }
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += RANDOM_CHARSET[Math.floor(Math.random() * RANDOM_CHARSET.length)];
  }
  return result;
}
