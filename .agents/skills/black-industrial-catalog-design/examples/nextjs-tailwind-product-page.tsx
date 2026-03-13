import type { CSSProperties } from "react";

const directoryGroups = [
  {
    title: "brand",
    items: ["2026 march"],
  },
  {
    title: "products",
    items: ["audio objects", "hardware systems", "catalog"],
  },
  {
    title: "store",
    items: ["visit store", "checkout"],
  },
  {
    title: "support",
    items: ["guides", "downloads", "contact"],
  },
];

const features = [
  {
    id: "01",
    title: "object first.",
    copy: "让产品成为画面主角，让 UI 退到秩序层。",
  },
  {
    id: "02",
    title: "grayscale logic.",
    copy: "黑灰白承担主要层级，强调色只做语义提示。",
  },
  {
    id: "03",
    title: "manual rhythm.",
    copy: "规格区像说明书，按钮像目录动作，而不是营销组件。",
  },
];

const specs = [
  ["tracks", "8 individually sequenceable tracks"],
  ["engines", "8 synth engines / 3 samplers"],
  ["screen", "480 x 222 grayscale display"],
  ["effects", "reverb / delay / chorus / distortion"],
  ["i/o", "usb-c / midi / multi-out / audio-in"],
  ["runtime", "portable / battery-powered / performance-first"],
];

const theme = {
  "--te-bg": "#000000",
  "--te-panel": "#0f0f10",
  "--te-card": "#e5e5e5",
  "--te-text": "#f5f5f5",
  "--te-text-muted": "#a1a1a1",
  "--te-line": "rgba(255,255,255,0.10)",
  fontFamily:
    '"Helvetica Neue", "Arial Nova", "Nimbus Sans", "Liberation Sans", sans-serif',
} as CSSProperties;

function DirectoryHeader() {
  return (
    <header className="border-b border-[var(--te-line)]">
      <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-4 px-6 py-6 md:px-10 xl:px-16">
        {directoryGroups.map((group) => (
          <div key={group.title} className="col-span-6 md:col-span-3">
            <div className="text-[28px] leading-[0.95] font-light text-[var(--te-text)] md:text-[34px]">
              {group.title}
            </div>
            <div className="mt-3 space-y-1.5">
              {group.items.map((item) => (
                <div
                  key={item}
                  className="text-[12px] leading-[1.2] font-light text-[var(--te-text-muted)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}

function DeviceMock() {
  return (
    <div className="relative h-[520px] overflow-hidden rounded-[28px] border border-white/8 bg-black md:h-[760px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(180deg,#020202_0%,#000_100%)]" />
      <div className="absolute left-[18%] top-[22%] h-[58%] w-[18%] rounded-[6px] bg-[linear-gradient(180deg,#f2f2f2_0%,#bdbdbd_18%,#8e8e8e_48%,#2f2f2f_100%)] opacity-85 md:left-[28%] md:top-[18%] md:h-[64%] md:w-[19%]" />
      <div className="absolute left-[40%] top-[32%] h-[220px] w-[220px] rounded-[18px] border border-white/8 bg-[#090909] md:left-[48%] md:top-[28%] md:h-[360px] md:w-[360px]">
        <div className="grid h-full grid-cols-4 gap-[1px] rounded-[18px] bg-white/6 p-[1px]">
          {Array.from({ length: 16 }).map((_, index) => {
            const isAccent = index === 5 || index === 9 || index === 10;

            return (
              <div key={index} className="relative overflow-hidden bg-[#070707]">
                <div
                  className={[
                    "absolute inset-[12%] rounded-full border border-white/6",
                    isAccent ? "bg-[#dedede]" : "bg-[rgba(255,255,255,0.03)]",
                  ].join(" ")}
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_30%,rgba(255,255,255,0.18),transparent_28%)]" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function BlackIndustrialProductPage() {
  return (
    <main
      style={theme}
      className="min-h-screen bg-[var(--te-bg)] text-[var(--te-text)]"
    >
      <DirectoryHeader />

      <section className="border-b border-[var(--te-line)]">
        <div className="mx-auto max-w-[1440px] px-6 py-8 md:px-10 md:py-10 xl:px-16">
          <div className="mb-10 flex items-center justify-between">
            <div className="inline-flex items-center gap-3">
              <span className="rounded-[4px] border border-white/15 px-1.5 py-1 text-[10px] uppercase tracking-[0.22em] text-white/75">
                OP
              </span>
              <span className="text-[28px] leading-none font-light tracking-[0.04em] md:text-[36px]">
                XY
              </span>
            </div>

            <a
              href="#shop"
              className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/70 transition-colors duration-200 hover:border-white/25 hover:text-white"
            >
              visit store
            </a>
          </div>

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-8">
              <h1 className="max-w-[920px] text-[52px] leading-[0.94] font-light tracking-[-0.04em] md:text-[88px]">
                black field
                <br />
                sequencing object.
              </h1>
            </div>

            <div className="col-span-12 md:col-span-4 md:pt-6">
              <p className="max-w-[360px] text-[16px] leading-[1.5] font-light text-[var(--te-text-muted)]">
                一台被当成展品来排版的设备。黑场、秩序、灰阶和特写一起把对象推到最前面。
              </p>
            </div>

            <div className="col-span-12 mt-4">
              <DeviceMock />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--te-line)] py-20 md:py-28">
        <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-4 px-6 md:px-10 xl:px-16">
          {features.map((feature) => (
            <article
              key={feature.id}
              className="col-span-12 border-t border-[var(--te-line)] pt-6 md:col-span-4"
            >
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                {feature.id}
              </div>
              <h3 className="mt-4 text-[30px] leading-[0.98] font-light md:text-[38px]">
                {feature.title}
              </h3>
              <p className="mt-4 max-w-[340px] text-[15px] leading-[1.55] font-light text-[var(--te-text-muted)]">
                {feature.copy}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="shop" className="py-20 md:py-28">
        <div className="mx-auto max-w-[1440px] px-6 md:px-10 xl:px-16">
          <div className="grid grid-cols-1 gap-y-5 md:grid-cols-2 md:gap-x-10">
            {specs.map(([label, value]) => (
              <div key={label} className="border-t border-[var(--te-line)] pt-4">
                <div className="text-[13px] uppercase tracking-[0.14em] text-white/88">
                  {label}
                </div>
                <div className="mt-2 text-[16px] leading-[1.45] font-light text-[var(--te-text-muted)]">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
