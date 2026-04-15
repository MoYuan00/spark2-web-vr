import type { PerformanceSettings } from "../viewer-config";

type PerformancePanelProps = {
  onPerformanceChange: (key: keyof PerformanceSettings, value: number) => void;
  onResetPerformance: () => void;
  performance: PerformanceSettings;
};

type SliderControlProps = {
  description: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  title: string;
  value: number;
  valueLabel: string;
};

function SliderControl({
  description,
  max,
  min,
  onChange,
  step,
  title,
  value,
  valueLabel,
}: SliderControlProps) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-sm text-white/90">{title}</span>
        <span className="text-cyan-200 text-xs">{valueLabel}</span>
      </div>
      <input
        className="w-full accent-cyan-400"
        max={max}
        min={min}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        step={step}
        type="range"
        value={value}
      />
      <p className="text-white/50 text-xs">{description}</p>
    </label>
  );
}

export function PerformancePanel({
  onPerformanceChange,
  onResetPerformance,
  performance,
}: PerformancePanelProps) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 flex p-4">
      <aside className="pointer-events-auto mt-20 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/65 shadow-2xl backdrop-blur-md">
        <div className="border-white/10 border-b p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-emerald-300 text-sm tracking-wide">
                性能调节
              </p>
              <p className="mt-1 text-white/60 text-xs">
                基于 Spark 2.0 文档暴露 LoD、foveation 与像素比参数。
              </p>
            </div>
            <button
              className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-medium text-white text-xs transition hover:bg-white/20"
              onClick={onResetPerformance}
              type="button"
            >
              重置
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <SliderControl
            description="对应文档中的 renderer pixel ratio，Vision / Quest 降低它通常最直接。"
            max={1.25}
            min={0.5}
            onChange={(value) => {
              onPerformanceChange("pixelRatio", value);
            }}
            step={0.05}
            title="像素比"
            value={performance.pixelRatio}
            valueLabel={`${performance.pixelRatio.toFixed(2)}x`}
          />
          <SliderControl
            description="Spark 文档建议 WebXR 走 LoD；预算越小，越稳但细节更少。"
            max={50000000}
            min={150000}
            onChange={(value) => {
              onPerformanceChange("lodSplatCount", value);
            }}
            step={50000}
            title="LoD 预算"
            value={performance.lodSplatCount}
            valueLabel={`${Math.round(performance.lodSplatCount / 1000)}k splats`}
          />
          <SliderControl
            description="值越高，Spark 越少浪费预算在极小 splat 上。"
            max={4}
            min={1}
            onChange={(value) => {
              onPerformanceChange("lodRenderScale", value);
            }}
            step={0.1}
            title="LoD 像素阈值"
            value={performance.lodRenderScale}
            valueLabel={`${performance.lodRenderScale.toFixed(2)} px`}
          />
          <SliderControl
            description="文档建议 VR 可降到 √5 附近，以减少高斯覆盖面积与混合压力。"
            max={2.83}
            min={2}
            onChange={(value) => {
              onPerformanceChange("maxStdDev", value);
            }}
            step={0.05}
            title="最大高斯范围"
            value={performance.maxStdDev}
            valueLabel={`${performance.maxStdDev.toFixed(2)}σ`}
          />
          <SliderControl
            description="降低视野边缘的 LoD 细节，有利于头显双眼渲染稳定性。"
            max={1}
            min={0.1}
            onChange={(value) => {
              onPerformanceChange("coneFoveate", value);
            }}
            step={0.05}
            title="边缘视锥降采样"
            value={performance.coneFoveate}
            valueLabel={`${performance.coneFoveate.toFixed(2)}x`}
          />
          <SliderControl
            description="头显最有效的参数之一；越低表示身后 splat 越粗、开销越小。"
            max={1}
            min={0.05}
            onChange={(value) => {
              onPerformanceChange("behindFoveate", value);
            }}
            step={0.05}
            title="身后 Foveation"
            value={performance.behindFoveate}
            valueLabel={`${performance.behindFoveate.toFixed(2)}x`}
          />
        </div>
      </aside>
    </div>
  );
}
