import { CameraControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { SplatMesh as SparkSplatMesh } from "@sparkjsdev/spark";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WebGLRenderer } from "three";
import { SparkRenderer } from "./components/spark/SparkRenderer";
import { SplatMesh } from "./components/spark/SplatMesh";

const DEFAULT_SPLAT_URL = "/assets/splats/butterfly.spz";
const DEFAULT_SPLAT_NAME = "butterfly.spz";
const XR_SESSION_MODES = ["immersive-vr", "immersive-ar"] as const;
const XR_SESSION_OPTIONS: XRSessionInit = {
  optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking", "layers"],
};

type SceneProps = {
  onRendererReady: (renderer: WebGLRenderer | null) => void;
  splatUrl: string;
  xrActive: boolean;
};

function App() {
  const [splatUrl, setSplatUrl] = useState(DEFAULT_SPLAT_URL);
  const [splatName, setSplatName] = useState(DEFAULT_SPLAT_NAME);
  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null);
  const [xrMode, setXrMode] = useState<
    (typeof XR_SESSION_MODES)[number] | null
  >(null);
  const [xrSession, setXrSession] = useState<XRSession | null>(null);
  const [xrBusy, setXrBusy] = useState(false);
  const [xrMessage, setXrMessage] = useState<string | null>(null);
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

      if (!file.name.toLowerCase().endsWith(".spz")) {
        setXrMessage("请选择 .spz 格式的 Gaussian Splat 文件。");
        event.target.value = "";
        return;
      }

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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-neutral-950 text-white">
      <Canvas gl={{ antialias: false }}>
        <Scene
          onRendererReady={setRenderer}
          splatUrl={splatUrl}
          xrActive={xrSession !== null}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
        <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-white/15 bg-black/60 p-4 shadow-2xl backdrop-blur-md sm:flex-row sm:items-end sm:justify-between">
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
              支持上传本地 .spz 文件即时替换场景内容，并切换到 WebXR 预览模式。
            </p>
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

          <div className="flex shrink-0 flex-wrap gap-2">
            <input
              ref={fileInputRef}
              accept=".spz"
              className="hidden"
              onChange={handleSplatUpload}
              type="file"
            />
            <button
              className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 font-medium text-cyan-100 text-sm transition hover:bg-cyan-400/20"
              onClick={handleUploadClick}
              type="button"
            >
              上传 SPZ
            </button>
            <button
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 font-medium text-sm text-white transition hover:bg-white/20"
              onClick={handleResetSplat}
              type="button"
            >
              恢复默认
            </button>
            <button
              className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 font-medium text-emerald-100 text-sm transition enabled:hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/40"
              disabled={!xrMode || !renderer || xrBusy}
              onClick={() => void handleVrToggle()}
              type="button"
            >
              {xrButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Separate `Scene` component to be used in the React Three Fiber `Canvas` component so that we can use React Three Fiber hooks like `useThree`
 */
const Scene = ({ onRendererReady, splatUrl, xrActive }: SceneProps) => {
  const renderer = useThree((state) => state.gl);
  const meshRef = useRef<SparkSplatMesh>(null);

  useEffect(() => {
    renderer.xr.enabled = true;
    onRendererReady(renderer);

    return () => {
      onRendererReady(null);
    };
  }, [onRendererReady, renderer]);

  const sparkRendererArgs = useMemo(() => {
    return { renderer };
  }, [renderer]);

  const splatMeshArgs = useMemo(
    () =>
      ({
        url: splatUrl,
      }) as const,
    [splatUrl],
  );

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.5 * delta;
    }
  });

  return (
    <>
      {!xrActive ? <CameraControls /> : null}
      <SparkRenderer args={[sparkRendererArgs]}>
        <group rotation={[Math.PI, 0, 0]}>
          <SplatMesh key={splatUrl} ref={meshRef} args={[splatMeshArgs]} />
        </group>
      </SparkRenderer>
    </>
  );
};

export default App;
