/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { useEffect, useState } from "react";

/** Parse hue from any color string (hex #rrggbb or hsl(h, ...)). Returns 0–360. */
export function colorToHue(color: string | undefined): number {
  if (!color) return 0;
  const hslMatch = color.match(/^hsl\(\s*(\d+)/);
  if (hslMatch) return Number(hslMatch[1]);
  if (color.startsWith("#") && color.length >= 7) {
    const r = Number.parseInt(color.slice(1, 3), 16) / 255;
    const g = Number.parseInt(color.slice(3, 5), 16) / 255;
    const b = Number.parseInt(color.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return 0;
    let h = 0;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    return h < 0 ? h + 360 : h;
  }
  return 0;
}

/** Inline hue slider for color panels. */
export function HueSlider({ value, onChange }: { value: string | undefined; onChange: (color: string) => void }) {
  const [localHue, setLocalHue] = useState(() => colorToHue(value));
  const externalHue = colorToHue(value);

  // 逻辑：外部颜色变化（如点击预设）时同步滑条位置。
  useEffect(() => {
    setLocalHue(externalHue);
  }, [externalHue]);

  return (
    <input
      type="range"
      min={0}
      max={360}
      value={localHue}
      onChange={(e) => {
        const h = Number(e.target.value);
        setLocalHue(h);
        onChange(`hsl(${h}, 70%, 50%)`);
      }}
      className="mt-1.5 h-2.5 w-full cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_rgba(0,0,0,0.25)] [&::-webkit-slider-thumb]:ring-0"
      style={{
        background: "linear-gradient(to right, hsl(0,70%,50%), hsl(60,70%,50%), hsl(120,70%,50%), hsl(180,70%,50%), hsl(240,70%,50%), hsl(300,70%,50%), hsl(360,70%,50%))",
      }}
    />
  );
}

/** Default color presets shared by all color panels (3 items). */
export const DEFAULT_COLOR_PRESETS: string[] = ["#171717", "#1d4ed8", "#f59e0b"];

/** Maximum number of color swatches shown in a panel. */
const MAX_COLOR_SWATCHES = 6;

/** Build a merged color list: default presets + history colors (deduped, max 6). */
export function buildColorSwatches(defaults: string[], history: string[]): string[] {
  const seen = new Set(defaults);
  const extra = history.filter(c => !seen.has(c));
  return [...defaults, ...extra].slice(0, MAX_COLOR_SWATCHES);
}
