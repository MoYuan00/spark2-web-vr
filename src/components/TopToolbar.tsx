import type { ChangeEventHandler, RefObject } from "react";
import type {
  DownloadProgress,
  LodProgress,
  XrSessionMode,
} from "../viewer-config";
import { ProgressBar } from "./ProgressBar";

type TopToolbarProps = {
  downloadProgress: DownloadProgress;
  fileInputRef: RefObject<HTMLInputElement | null>;
  formatSpeed: (bytesPerSecond: number) => string;
  lodProgress: LodProgress;
  onSplatUpload: ChangeEventHandler<HTMLInputElement>;
  onUploadClick: () => void;
  onVrToggle: () => void;
  splatName: string;
  xrButtonLabel: string;
  xrMessage: string | null;
  xrMode: XrSessionMode | null;
  xrToggleDisabled: boolean;
};

export function TopToolbar({
  downloadProgress,
  fileInputRef,
  formatSpeed,
  lodProgress,
  onSplatUpload,
  onUploadClick,
  onVrToggle,
  splatName,
  xrButtonLabel,
  xrMessage,
  xrMode,
  xrToggleDisabled,
}: TopToolbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4 pr-4 pl-4 sm:pr-[22rem] sm:pl-80">
      <div className="pointer-events-auto relative flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-white/15 bg-black/60 p-4 shadow-2xl backdrop-blur-md">
        <ProgressBar
          downloadProgress={downloadProgress}
          formatSpeed={formatSpeed}
          lodProgress={lodProgress}
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="font-semibold text-cyan-300 text-sm tracking-wide">
              Spark SPZ 预览
            </p>
            <div>
              <p className="text-white/50 text-xs uppercase tracking-[0.2em]">
                当前模型
              </p>
              <p className="max-w-sm truncate text-sm text-white/90">
                {splatName}
              </p>
            </div>
            <p className="text-white/60 text-xs">
              XR 支持：
              {xrMode
                ? xrMode === "immersive-ar"
                  ? "当前环境仅检测到空间模式支持"
                  : "检测到沉浸式 VR 支持"
                : "当前浏览器/设备暂不可用"}
            </p>
            {xrMessage ? (
              <p className="text-amber-300 text-xs">{xrMessage}</p>
            ) : null}
          </div>
        </div>
         <div className="flex shrink-0 flex-wrap gap-2 sm:pt-6">
            <input
              ref={fileInputRef}
              accept=".spz,.ply,.sog"
              className="hidden"
              onChange={onSplatUpload}
              type="file"
            />
            <button
              className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 font-medium text-cyan-100 text-sm transition hover:bg-cyan-400/20"
              onClick={onUploadClick}
              type="button"
            >
              上传 SPZ/PLY/SOG
            </button>
            <button
              className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 font-medium text-emerald-100 text-sm transition enabled:hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/40"
              disabled={xrToggleDisabled}
              onClick={onVrToggle}
              type="button"
            >
              {xrButtonLabel}
            </button>
          </div>
      </div>
    </div>
  );
}
