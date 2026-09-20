/**
 * The dedication, in two forms sharing one source of truth for the text:
 * the full-screen interstitial the owner sees after signing in, and the
 * inline block the public About page carries.
 */

export function DedicationText() {
  return (
    <>
      <div className="space-y-5">
        <p className="text-primary font-bold text-lg sm:text-2xl md:text-3xl tracking-wide leading-relaxed font-serif">
          "And when you have decided, then rely upon Allah. Indeed, Allah loves those who rely
          [upon Him]."
        </p>
        <p className="text-white/50 font-mono text-xs tracking-[0.2em] uppercase">
          — Surah Ali 'Imran [3:159]
        </p>
      </div>

      <div className="w-2/3 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent mx-auto" />

      <div className="space-y-4">
        <p className="text-white font-mono text-base sm:text-lg md:text-xl tracking-wide">
          Dedicated to Eman Endris.
        </p>
        <p className="text-white/70 font-mono text-xs sm:text-sm md:text-base leading-relaxed max-w-xl mx-auto italic">
          My best friend, my anchor, and the only person I can truly depend on.
        </p>
        <p className="text-primary/80 font-mono text-xs tracking-[0.2em] pt-4 uppercase">
          — Yitbarek Tegene (Barack Mohammed)
        </p>
      </div>
    </>
  );
}

export function DedicationScreen({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="h-[100dvh] w-full bg-neutral-950 flex items-center justify-center p-5 sm:p-6 relative overflow-y-auto">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-3xl space-y-9 sm:space-y-14 relative z-10 text-center py-8">
        <DedicationText />

        <button
          onClick={onEnter}
          className="border border-primary/50 text-primary hover:bg-primary/10 px-10 py-4 font-mono text-xs tracking-[0.2em] transition-all hover:scale-105"
        >
          [ ENTER ARCHITECTURE ]
        </button>
      </div>
    </div>
  );
}
