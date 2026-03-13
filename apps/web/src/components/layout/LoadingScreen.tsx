/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { AnimatedText } from "@openloaf/ui/animated-shiny-text";
import { WavyBackground } from "@openloaf/ui/wavy-background";

export function LoadingScreen() {
  return (
    <WavyBackground
      className="max-w-4xl mx-auto pb-40"
      containerClassName="h-svh w-full overflow-hidden"
    >
      <AnimatedText
        text="OpenLoaf"
        textClassName="text-[4rem] md:text-[6rem] font-bold tracking-widest"
        gradientColors="linear-gradient(90deg, #0f0e12, #a1a7af, #0f0e12)"
        darkGradientColors="linear-gradient(90deg, #f5f5f5, #a1a7af, #f5f5f5)"
        gradientAnimationDuration={3}
        className="py-0"
      />
      <p className="text-base md:text-lg mt-4 font-normal text-center text-[#a1a7af] dark:text-[#a1a7af]">
        Think less, do more.
      </p>
    </WavyBackground>
  );
}
