import { cn } from "@/lib/utils";

interface AnimatedTextProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string;
  gradientColors?: string;
  darkGradientColors?: string;
  gradientAnimationDuration?: number;
  className?: string;
  textClassName?: string;
}

function AnimatedText({
  text,
  gradientColors = "linear-gradient(90deg, #000, #fff, #000)",
  darkGradientColors,
  gradientAnimationDuration = 1,
  className,
  textClassName,
  ...props
}: AnimatedTextProps) {
  const id = "shiny-text";

  return (
    <div
      className={cn("flex justify-center items-center py-8", className)}
      {...props}
    >
      <h1
        className={cn(
          id,
          "text-[2.5rem] sm:text-[3.5rem] md:text-[4rem] lg:text-[5rem] xl:text-[6rem] leading-normal",
          textClassName,
        )}
      >
        {text}
      </h1>
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS keyframes
        dangerouslySetInnerHTML={{
          __html: `
@keyframes shiny-text-sweep {
  0% { background-position: 0 0; }
  100% { background-position: 100% 0; }
}
.${id} {
  background-image: ${gradientColors};
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shiny-text-sweep ${gradientAnimationDuration}s ease-in-out infinite alternate;
}
${
  darkGradientColors
    ? `:is(.dark .${id}) { background-image: ${darkGradientColors}; }`
    : ""
}`,
        }}
      />
    </div>
  );
}

export { AnimatedText };
