import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const WavyBackground = ({
  children,
  className,
  containerClassName,
}: {
  children?: ReactNode;
  className?: string;
  containerClassName?: string;
}) => {
  return (
    <div
      className={cn(
        "h-screen flex flex-col items-center justify-center relative overflow-hidden",
        "animate-[gradient_15s_ease_infinite] bg-[length:400%_400%] bg-fixed",
        "wavy-bg-container",
        containerClassName,
      )}
    >
      {/* Ambient glow */}
      <div className="wavy-glow wavy-glow-1" />
      <div className="wavy-glow wavy-glow-2" />
      {/* Waves */}
      <div className="wave" />
      <div className="wave wave-2" />
      <div className="wave wave-3" />
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS keyframes
        dangerouslySetInnerHTML={{
          __html: `
.wavy-bg-container {
  background-image: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%, #f8fafc 100%);
}
:is(.dark .wavy-bg-container) {
  background-image: linear-gradient(135deg, #000000 0%, #0a0a0a 25%, #111111 50%, #0a0a0a 75%, #000000 100%);
}
@keyframes gradient {
  0% { background-position: 0% 0%; }
  50% { background-position: 100% 100%; }
  100% { background-position: 0% 0%; }
}

/* Ambient glow blobs */
.wavy-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  z-index: 0;
  animation: glow-drift 12s ease-in-out infinite alternate;
}
.wavy-glow-1 {
  width: 40%;
  height: 40%;
  top: 10%;
  left: 15%;
  background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%);
}
:is(.dark .wavy-glow-1) {
  background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
}
.wavy-glow-2 {
  width: 35%;
  height: 35%;
  top: 20%;
  right: 10%;
  animation-delay: -5s;
  animation-duration: 16s;
  background: radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%);
}
:is(.dark .wavy-glow-2) {
  background: radial-gradient(circle, rgba(168,85,247,0.10) 0%, transparent 70%);
}
@keyframes glow-drift {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(5%, -8%) scale(1.1); }
  100% { transform: translate(-3%, 5%) scale(0.95); }
}

/* Waves */
@keyframes wave {
  2% { transform: translateX(1px); }
  25% { transform: translateX(-25%); }
  50% { transform: translateX(-50%); }
  75% { transform: translateX(-25%); }
  100% { transform: translateX(1px); }
}
.wave {
  border-radius: 1000% 1000% 0 0;
  position: absolute;
  width: 200%;
  height: 22em;
  animation: wave 10s -3s linear infinite;
  transform: translate3d(0, 0, 0);
  opacity: 0.6;
  bottom: 0;
  left: 0;
  z-index: 0;
  background: linear-gradient(180deg, rgba(210,210,215,0.3) 0%, rgba(232,232,237,0.5) 100%);
}
:is(.dark .wave) {
  background: linear-gradient(180deg, rgba(110,110,115,0.06) 0%, rgba(161,161,166,0.1) 100%);
}
.wave-2 {
  bottom: -1.25em;
  animation: wave 18s linear reverse infinite;
  opacity: 0.5;
  background: linear-gradient(180deg, rgba(174,174,178,0.25) 0%, rgba(242,242,247,0.4) 100%);
}
:is(.dark .wave-2) {
  background: linear-gradient(180deg, rgba(99,99,102,0.06) 0%, rgba(142,142,147,0.08) 100%);
}
.wave-3 {
  bottom: -2.5em;
  animation: wave 20s -1s reverse infinite;
  opacity: 0.7;
  background: linear-gradient(180deg, rgba(142,142,147,0.2) 0%, rgba(245,245,247,0.5) 100%);
}
:is(.dark .wave-3) {
  background: linear-gradient(180deg, rgba(72,72,74,0.06) 0%, rgba(110,110,115,0.08) 100%);
}`,
        }}
      />
      <div className={cn("relative z-10", className)}>{children}</div>
    </div>
  );
};
