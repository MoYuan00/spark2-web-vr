import type { DownloadProgress, LodProgress } from "../viewer-config";

type ProgressBarProps = {
  downloadProgress: DownloadProgress;
  formatSpeed: (bytesPerSecond: number) => string;
  lodProgress: LodProgress;
};

export function ProgressBar({
  downloadProgress,
  formatSpeed,
  lodProgress,
}: ProgressBarProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${units[i]}`;
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 1) {
      return `${Math.round(seconds * 1000)}ms`;
    }
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const downloadProgressPercent =
    downloadProgress.total > 0
      ? Math.round((downloadProgress.loaded / downloadProgress.total) * 100)
      : 0;

  const lodProgressPercent =
    lodProgress.totalSplats > 0
      ? Math.round((lodProgress.processedSplats / lodProgress.totalSplats) * 100)
      : 0;

  const isLoading = downloadProgress.isDownloading || lodProgress.isProcessing;
  const currentProgressPercent = downloadProgress.isDownloading
    ? downloadProgressPercent
    : lodProgressPercent;

  if (!isLoading) return null;

  return (
    <>
      {/* Progress bar at top */}
      <div className="absolute inset-x-0 top-0 h-1 w-full overflow-hidden rounded-t-2xl">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300 ease-out"
          style={{ width: `${currentProgressPercent}%` }}
        />
      </div>

      {/* Download progress info */}
      {downloadProgress.isDownloading && (
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-cyan-200 text-xs">
              {downloadProgress.fileName}
            </span>
            <span className="shrink-0 font-semibold text-cyan-300 text-xs">
              {downloadProgressPercent}%
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs">
            <span className="text-cyan-100/70">
              {formatBytes(downloadProgress.loaded)} /{" "}
              {formatBytes(downloadProgress.total)}
            </span>
            {downloadProgress.speed > 0 && (
              <span className="font-medium text-emerald-300">
                {formatSpeed(downloadProgress.speed)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* LoD progress info */}
      {lodProgress.isProcessing && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-amber-200 text-xs">
              LoD: {lodProgress.fileName}
            </span>
            <span className="shrink-0 font-semibold text-amber-300 text-xs">
              {lodProgressPercent}%
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs">
            <span className="text-amber-100/70">
              初始化中...
            </span>
            {lodProgress.estimatedTimeRemaining > 0 && (
              <span className="font-medium text-emerald-300">
                剩余 {formatTime(lodProgress.estimatedTimeRemaining)}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
