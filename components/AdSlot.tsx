const SIZES = {
  'footer-mobile': { w: 320, h: 50 },
  'footer-desktop': { w: 728, h: 90 },
  tower: { w: 300, h: 600 },
  rectangle: { w: 300, h: 250 },
} as const;

export function AdSlot({ size }: { size: keyof typeof SIZES }) {
  const { w, h } = SIZES[size];
  return (
    <div
      aria-label="advertisement"
      style={{ minWidth: w, minHeight: h, width: w, height: h }}
      className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border-soft)] bg-[var(--bg-elev)]/40 text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]"
    >
      Advertisement
    </div>
  );
}
