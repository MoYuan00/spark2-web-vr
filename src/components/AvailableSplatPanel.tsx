import { type AvailableSplat, SPLAT_SECTIONS } from "../viewer-config";

type AvailableSplatPanelProps = {
  isLocalUpload: boolean;
  onSelectAvailableSplat: (selectedSplat: AvailableSplat) => void;
  splatName: string;
  splatUrl: string;
};

export function AvailableSplatPanel({
  isLocalUpload,
  onSelectAvailableSplat,
  splatName,
  splatUrl,
}: AvailableSplatPanelProps) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 flex p-4">
      <aside className="pointer-events-auto mt-20 flex w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/65 shadow-2xl backdrop-blur-md">
        <div className="border-white/10 border-b p-4">
          <p className="font-semibold text-cyan-300 text-sm tracking-wide">
            可用 SPZ 列表
          </p>
          <p className="mt-1 text-white/60 text-xs">
            点击条目即可切换当前显示的 Gaussian Splat。
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-3">
          {isLocalUpload ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
              <p className="font-medium text-amber-200 text-sm">
                当前为本地上传
              </p>
              <p className="mt-1 truncate text-amber-100/80 text-xs">
                {splatName}
              </p>
            </div>
          ) : null}

          {SPLAT_SECTIONS.map((section) => (
            <div className="space-y-2" key={section.title}>
              <p className="text-white/45 text-xs uppercase tracking-[0.2em]">
                {section.title}
              </p>
              <div className="space-y-2">
                {section.items.map((item) => {
                  const isActive = !isLocalUpload && splatUrl === item.url;

                  return (
                    <button
                      className={`flex w-full flex-col rounded-xl border px-3 py-2 text-left transition ${
                        isActive
                          ? "border-cyan-400/50 bg-cyan-400/15 text-white"
                          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                      }`}
                      key={item.url}
                      onClick={() => onSelectAvailableSplat(item)}
                      type="button"
                    >
                      <span className="font-medium text-sm">
                        {item.label}
                      </span>
                      <span className="mt-1 truncate text-white/50 text-xs">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
