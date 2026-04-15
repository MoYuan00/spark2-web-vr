type FpsBadgeProps = {
  fps: number;
};

export function FpsBadge({ fps }: FpsBadgeProps) {
  return (
    <div className="pointer-events-none absolute top-4 right-4 z-10">
      <div className="rounded-2xl border border-white/15 bg-black/65 px-4 py-3 shadow-2xl backdrop-blur-md">
        <p className="font-medium text-[11px] text-white/50 uppercase tracking-[0.2em]">
          FPS
        </p>
        <p className="mt-1 font-semibold text-emerald-300 text-xl tabular-nums">
          {fps > 0 ? fps.toFixed(1) : "--"}
        </p>
      </div>
    </div>
  );
}
