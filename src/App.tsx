import { Canvas } from "@react-three/fiber";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WebGLRenderer } from "three";
import { AvailableSplatPanel } from "./components/AvailableSplatPanel";
import { FpsBadge } from "./components/FpsBadge";
import { PerformancePanel } from "./components/PerformancePanel";
import { TopToolbar } from "./components/TopToolbar";
import { ViewerScene } from "./components/ViewerScene";
import {
  type AvailableSplat,
  DEFAULT_DOWNLOAD_PROGRESS,
  DEFAULT_LOD_PROGRESS,
  DEFAULT_PERFORMANCE_SETTINGS,
  DEFAULT_SPLAT_NAME,
  DEFAULT_SPLAT_URL,
  type DownloadProgress,
  type LodProgress,
  type PerformanceSettings,
  XR_SESSION_MODES,
  XR_SESSION_OPTIONS,
  type XrSessionMode,
} from "./viewer-config";

function App() {
  const [splatUrl, setSplatUrl] = useState(DEFAULT_SPLAT_URL);
  const [splatName, setSplatName] = useState(DEFAULT_SPLAT_NAME);
  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null);
  const [xrMode, setXrMode] = useState<XrSessionMode | null>(null);
  const [xrSession, setXrSession] = useState<XRSession | null>(null);
  const [xrBusy, setXrBusy] = useState(false);
  const [xrMessage, setXrMessage] = useState<string | null>(null);
  const [performance, setPerformance] = useState(DEFAULT_PERFORMANCE_SETTINGS);
  const [fps, setFps] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>(DEFAULT_DOWNLOAD_PROGRESS);
  const [lodProgress, setLodProgress] = useState<LodProgress>(DEFAULT_LOD_PROGRESS);
  const lodStartTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const xrSessionRef = useRef<XRSession | null>(null);
  const downloadAbortRef = useRef<AbortController | null>(null);

  const releaseObjectUrl = useCallback((nextUrl?: string) => {
    const currentObjectUrl = objectUrlRef.current;

    if (currentObjectUrl && currentObjectUrl !== nextUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    xrSessionRef.current = xrSession;
  }, [xrSession]);

  useEffect(() => {
    let cancelled = false;

    const checkXrSupport = async () => {
      if (!navigator.xr) {
        return;
      }

      for (const mode of XR_SESSION_MODES) {
        try {
          const supported = await navigator.xr.isSessionSupported(mode);

          if (!cancelled && supported) {
            setXrMode(mode);
            return;
          }
        } catch {
          if (!cancelled) {
            setXrMessage("当前浏览器未启用 WebXR，请确认浏览器与设备设置。");
          }
        }
      }
    };

    void checkXrSupport();

    return () => {
      cancelled = true;
      releaseObjectUrl();

      if (xrSessionRef.current) {
        void xrSessionRef.current.end().catch(() => undefined);
      }
    };
  }, [releaseObjectUrl]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSplatUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      setDownloadProgress({
        loaded: 0,
        total: file.size,
        speed: 0,
        isDownloading: true,
        fileName: file.name,
      });

      const reader = new FileReader();
      const startTime = window.performance.now();

      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const currentTime = window.performance.now();
          const timeDiff = (currentTime - startTime) / 1000;
          const speed = timeDiff > 0 ? e.loaded / timeDiff : 0;

          setDownloadProgress({
            loaded: e.loaded,
            total: e.total,
            speed: speed,
            isDownloading: true,
            fileName: file.name,
          });
        }
      };

      reader.onloadend = () => {
        setDownloadProgress((prev) => ({
          ...prev,
          loaded: file.size,
          total: file.size,
          speed: 0,
          isDownloading: false,
        }));

        // 开始 LoD 处理进度（将在 SplatMesh onLoad 中结束）
        lodStartTimeRef.current = window.performance.now(); // 重置开始时间
        setLodProgress({
          processedSplats: 0,
          totalSplats: 100, // 百分比
          isProcessing: true,
          fileName: file.name,
          estimatedTimeRemaining: 20, // 20 秒倒计时
        });

        const nextObjectUrl = URL.createObjectURL(file);
        releaseObjectUrl(nextObjectUrl);
        objectUrlRef.current = nextObjectUrl;
        setSplatUrl(nextObjectUrl);
        setSplatName(file.name);
        setXrMessage(null);
      };

      reader.onerror = () => {
        setDownloadProgress(DEFAULT_DOWNLOAD_PROGRESS);
        setXrMessage("文件读取失败，请重试。");
      };

      reader.readAsArrayBuffer(file);
      event.target.value = "";
    },
    [releaseObjectUrl],
  );

  const formatSpeed = useCallback((bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return "0 B/s";
    const units = ["B/s", "KB/s", "MB/s", "GB/s"];
    const k = 1024;
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return `${parseFloat((bytesPerSecond / k ** i).toFixed(2))} ${units[i]}`;
  }, []);

  const downloadWithProgress = useCallback(
    async (url: string, fileName: string): Promise<Blob> => {
      if (downloadAbortRef.current) {
        downloadAbortRef.current.abort();
      }
      const abortController = new AbortController();
      downloadAbortRef.current = abortController;

      setDownloadProgress({
        ...DEFAULT_DOWNLOAD_PROGRESS,
        isDownloading: true,
        fileName,
      });

      try {
        const response = await fetch(url, { signal: abortController.signal });
        const total = Number(response.headers.get("content-length")) || 0;
        const reader = response.body?.getReader();

        if (!reader) {
          throw new Error("无法读取响应流");
        }

        const chunks: BlobPart[] = [];
        let loaded = 0;
        let lastTime = window.performance.now();
        let lastLoaded = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value) {
            chunks.push(value);
            loaded += value.length;

            const currentTime = window.performance.now();
            const timeDiff = (currentTime - lastTime) / 1000;

            if (timeDiff >= 0.5) {
              const bytesDiff = loaded - lastLoaded;
              const speed = bytesDiff / timeDiff;

              setDownloadProgress({
                loaded,
                total,
                speed,
                isDownloading: true,
                fileName,
              });

              lastTime = currentTime;
              lastLoaded = loaded;
            }
          }
        }

        const blob = new Blob(chunks);
        setDownloadProgress((prev) => ({
          ...prev,
          loaded,
          total: loaded,
          speed: 0,
          isDownloading: false,
        }));

        // 开始 LoD 处理进度（将在 SplatMesh onLoad 中结束）
        lodStartTimeRef.current = window.performance.now(); // 重置开始时间
        setLodProgress({
          processedSplats: 0,
          totalSplats: 100, // 百分比
          isProcessing: true,
          fileName,
          estimatedTimeRemaining: 20, // 20 秒倒计时
        });

        return blob;
      } catch (error) {
        setDownloadProgress(DEFAULT_DOWNLOAD_PROGRESS);
        throw error;
      }
    },
    [],
  );

  const handleSelectAvailableSplat = useCallback(
    async (selectedSplat: AvailableSplat) => {
      releaseObjectUrl();
      setXrMessage(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      try {
        const blob = await downloadWithProgress(selectedSplat.url, selectedSplat.name);
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        setSplatUrl(objectUrl);
        setSplatName(selectedSplat.name);
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          setXrMessage(`下载失败: ${error.message}`);
        }
        setSplatUrl(selectedSplat.url);
        setSplatName(selectedSplat.name);
      }
    },
    [releaseObjectUrl, downloadWithProgress],
  );

  const handlePerformanceChange = useCallback(
    (key: keyof PerformanceSettings, value: number) => {
      setPerformance((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  const handleLodProgress = useCallback((progress: LodProgress) => {
    setLodProgress(progress);
  }, []);

  // LoD 进度更新 - 固定 20 秒倒计时
  useEffect(() => {
    if (!lodProgress.isProcessing) return;

    const intervalId = setInterval(() => {
      setLodProgress((prev) => {
        if (!prev.isProcessing) return prev;

        const elapsed = (window.performance.now() - lodStartTimeRef.current) / 1000;
        const remainingTime = Math.max(0, 20 - elapsed);
        const progress = Math.min(elapsed / 20, 0.99); // 最多到 99%，等 onLoad 完成到 100%

        return {
          ...prev,
          processedSplats: Math.floor(progress * 100),
          totalSplats: 100,
          estimatedTimeRemaining: remainingTime,
        };
      });
    }, 100);

    return () => {
      clearInterval(intervalId);
    };
  }, [lodProgress.isProcessing]);

  const handleResetPerformance = useCallback(() => {
    setPerformance(DEFAULT_PERFORMANCE_SETTINGS);
  }, []);

  const handleVrToggle = useCallback(async () => {
    if (xrBusy) {
      return;
    }

    if (xrSession) {
      setXrBusy(true);

      try {
        await xrSession.end();
        setXrMessage(null);
      } catch {
        setXrMessage("退出 VR 失败，请重试。");
      } finally {
        setXrBusy(false);
      }

      return;
    }

    if (!xrMode) {
      setXrMessage("当前设备或浏览器不支持沉浸式 WebXR 模式。");
      return;
    }

    if (!renderer) {
      setXrMessage("3D 渲染器尚未就绪，请稍后重试。");
      return;
    }

    if (!navigator.xr) {
      setXrMessage("当前浏览器未提供 WebXR 接口。");
      return;
    }

    setXrBusy(true);
    setXrMessage(null);

    try {
      renderer.xr.enabled = true;
      const session = await navigator.xr.requestSession(
        xrMode,
        XR_SESSION_OPTIONS,
      );

      session.addEventListener(
        "end",
        () => {
          setXrSession(null);
          setXrBusy(false);
        },
        { once: true },
      );

      await renderer.xr.setSession(session);
      setXrSession(session);
    } catch (error) {
      if (error instanceof Error) {
        setXrMessage(error.message);
      } else {
        setXrMessage("进入 VR 失败，请确认浏览器已授权访问 XR 设备。");
      }
    } finally {
      setXrBusy(false);
    }
  }, [renderer, xrBusy, xrMode, xrSession]);

  const xrButtonLabel = xrSession
    ? "退出 VR"
    : xrBusy
      ? "处理中..."
      : xrMode === "immersive-ar"
        ? "进入空间预览"
        : "进入 VR";

  const isLocalUpload = splatUrl.startsWith("blob:");

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-neutral-950 text-white">
      <Canvas dpr={performance.pixelRatio} gl={{ antialias: false }}>
        <ViewerScene
          onFpsChange={setFps}
          onLodProgress={handleLodProgress}
          onRendererReady={setRenderer}
          performance={performance}
          splatUrl={splatUrl}
          xrActive={xrSession !== null}
        />
      </Canvas>

      <AvailableSplatPanel
        isLocalUpload={isLocalUpload}
        onSelectAvailableSplat={handleSelectAvailableSplat}
        splatName={splatName}
        splatUrl={splatUrl}
      />
      <FpsBadge fps={fps} />
      <PerformancePanel
        onPerformanceChange={handlePerformanceChange}
        onResetPerformance={handleResetPerformance}
        performance={performance}
      />
      <TopToolbar
        downloadProgress={downloadProgress}
        fileInputRef={fileInputRef}
        formatSpeed={formatSpeed}
        lodProgress={lodProgress}
        onSplatUpload={handleSplatUpload}
        onUploadClick={handleUploadClick}
        onVrToggle={() => void handleVrToggle()}
        splatName={splatName}
        xrButtonLabel={xrButtonLabel}
        xrMessage={xrMessage}
        xrMode={xrMode}
        xrToggleDisabled={!xrMode || !renderer || xrBusy}
      />
    </div>
  );
}

export default App;
