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
  DEFAULT_PERFORMANCE_SETTINGS,
  DEFAULT_SPLAT_NAME,
  DEFAULT_SPLAT_URL,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const xrSessionRef = useRef<XRSession | null>(null);

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

      // if (!file.name.toLowerCase().endsWith(".spz")) {
      //   setXrMessage("请选择 .spz 格式的 Gaussian Splat 文件。");
      //   event.target.value = "";
      //   return;
      // }

      const nextObjectUrl = URL.createObjectURL(file);
      releaseObjectUrl(nextObjectUrl);
      objectUrlRef.current = nextObjectUrl;
      setSplatUrl(nextObjectUrl);
      setSplatName(file.name);
      setXrMessage(null);
      event.target.value = "";
    },
    [releaseObjectUrl],
  );

  const handleResetSplat = useCallback(() => {
    releaseObjectUrl();
    setSplatUrl(DEFAULT_SPLAT_URL);
    setSplatName(DEFAULT_SPLAT_NAME);
    setXrMessage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [releaseObjectUrl]);

  const handleSelectAvailableSplat = useCallback(
    (selectedSplat: AvailableSplat) => {
      releaseObjectUrl();
      setSplatUrl(selectedSplat.url);
      setSplatName(selectedSplat.name);
      setXrMessage(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [releaseObjectUrl],
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
        fileInputRef={fileInputRef}
        onResetSplat={handleResetSplat}
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
