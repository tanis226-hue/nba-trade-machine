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
      style={{ minWidth: w, minHeight: h }}
      className="flex items-center justify-center border border-dashed border-neutral-300 bg-neutral-100 text-xs text-neutral-400"
    >
      Ad {w}×{h}
    </div>
  );
}
