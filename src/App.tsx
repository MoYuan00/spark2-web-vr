import { CameraControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Group, Matrix4, Quaternion, Vector3 } from "three";
import type { WebGLRenderer } from "three";
import { SparkRenderer } from "./components/spark/SparkRenderer";
import { SplatMesh } from "./components/spark/SplatMesh";

type AvailableSplat = {
  label: string;
  name: string;
  url: string;
};

type SplatSection = {
  items: AvailableSplat[];
  title: string;
};

const SPLAT_SECTIONS: SplatSection[] = [
  {
    title: "精选",
    items: [
      {
        label: "Butterfly",
        name: "butterfly.spz",
        url: "/assets/splats/butterfly.spz",
      },
      {
        label: "Cat",
        name: "cat.spz",
        url: "/assets/splats/cat.spz",
      },
      {
        label: "2",
        name: "2.spz",
        url: "/assets/splats/hometree.spz",
      },
    ],
  },
  {
    title: "Food",
    items: [
      {
        label: "Branzino Amarin",
        name: "branzino-amarin.spz",
        url: "/assets/splats/food/branzino-amarin.spz",
      },
    ],
  },
];

const ALL_AVAILABLE_SPLATS = SPLAT_SECTIONS.flatMap((section) => section.items);

const DEFAULT_SPLAT =
  ALL_AVAILABLE_SPLATS.find((item) => item.name === "butterfly.spz") ??
  ALL_AVAILABLE_SPLATS[0];

if (!DEFAULT_SPLAT) {
  throw new Error("No SPZ assets configured.");
}

const DEFAULT_SPLAT_URL = DEFAULT_SPLAT.url;
const DEFAULT_SPLAT_NAME = DEFAULT_SPLAT.name;
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
      <Canvas gl={{ antialias: false }}>
        <Scene
          onRendererReady={setRenderer}
          splatUrl={splatUrl}
          xrActive={xrSession !== null}
        />
      </Canvas>

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
                        onClick={() => handleSelectAvailableSplat(item)}
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

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4 pl-4 sm:pl-80">
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
              支持上传本地 .spz 文件、点击左侧列表切换场景，并切换到 WebXR
              预览模式；Quest / Vision Pro 可在 XR 中按住并拖拽移动模型。
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
  const splatRootRef = useRef<Group>(null);
  const dragStateRef = useRef({
    active: false,
    dragDistance: 1.5,
    inputSource: null as XRInputSource | null,
    offset: new Vector3(),
  });

  const rayMatrix = useMemo(() => new Matrix4(), []);
  const rayQuaternion = useMemo(() => new Quaternion(), []);
  const rayOrigin = useMemo(() => new Vector3(), []);
  const rayDirection = useMemo(() => new Vector3(), []);
  const dragPoint = useMemo(() => new Vector3(), []);
  const objectPosition = useMemo(() => new Vector3(), []);
  const targetPosition = useMemo(() => new Vector3(), []);
  const worldOffset = useMemo(() => new Vector3(), []);

  useEffect(() => {
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType("local-floor");
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

  const stopDragging = useCallback(() => {
    dragStateRef.current.active = false;
    dragStateRef.current.inputSource = null;
  }, []);

  const updateInputRay = useCallback(
    (frame: XRFrame, inputSource: XRInputSource) => {
      const referenceSpace = renderer.xr.getReferenceSpace();

      if (!referenceSpace) {
        return null;
      }

      const pose = frame.getPose(inputSource.targetRaySpace, referenceSpace);

      if (!pose) {
        return null;
      }

      rayMatrix.fromArray(pose.transform.matrix);
      rayOrigin.setFromMatrixPosition(rayMatrix);
      rayQuaternion.setFromRotationMatrix(rayMatrix);
      rayDirection.set(0, 0, -1).applyQuaternion(rayQuaternion).normalize();

      return {
        direction: rayDirection,
        origin: rayOrigin,
      };
    },
    [rayDirection, rayMatrix, rayOrigin, rayQuaternion, renderer],
  );

  useEffect(() => {
    if (!xrActive) {
      stopDragging();
      return;
    }

    const session = renderer.xr.getSession();

    if (!session) {
      return;
    }

    const handleSelectStart = (event: XRInputSourceEvent) => {
      const splatRoot = splatRootRef.current;
      const ray = updateInputRay(event.frame, event.inputSource);

      if (!splatRoot || !ray) {
        return;
      }

      splatRoot.getWorldPosition(objectPosition);
      worldOffset.copy(objectPosition).sub(ray.origin);

      const dragDistance = Math.max(worldOffset.dot(ray.direction), 0.75);

      dragPoint.copy(ray.origin).addScaledVector(ray.direction, dragDistance);

      if (objectPosition.distanceTo(dragPoint) > 1.5) {
        return;
      }

      dragStateRef.current.active = true;
      dragStateRef.current.dragDistance = dragDistance;
      dragStateRef.current.inputSource = event.inputSource;
      dragStateRef.current.offset.copy(objectPosition).sub(dragPoint);
    };

    const handleSelectEnd = (event: XRInputSourceEvent) => {
      if (dragStateRef.current.inputSource === event.inputSource) {
        stopDragging();
      }
    };

    session.addEventListener("selectstart", handleSelectStart);
    session.addEventListener("selectend", handleSelectEnd);
    session.addEventListener("end", stopDragging);

    return () => {
      session.removeEventListener("selectstart", handleSelectStart);
      session.removeEventListener("selectend", handleSelectEnd);
      session.removeEventListener("end", stopDragging);
      stopDragging();
    };
  }, [
    dragPoint,
    objectPosition,
    renderer,
    stopDragging,
    updateInputRay,
    worldOffset,
    xrActive,
  ]);

  useFrame((_, __, frame) => {
    const splatRoot = splatRootRef.current;
    const dragState = dragStateRef.current;

    if (
      !xrActive ||
      !frame ||
      !splatRoot ||
      !dragState.active ||
      !dragState.inputSource
    ) {
      return;
    }

    const ray = updateInputRay(frame, dragState.inputSource);

    if (!ray) {
      return;
    }

    dragPoint
      .copy(ray.origin)
      .addScaledVector(ray.direction, dragState.dragDistance);
    targetPosition.copy(dragPoint).add(dragState.offset);
    splatRoot.position.copy(targetPosition);
  });

  return (
    <>
      {!xrActive ? <CameraControls /> : null}
      <SparkRenderer args={[sparkRendererArgs]}>
        <group ref={splatRootRef}>
          <group rotation={[Math.PI, 0, 0]}>
            <SplatMesh key={splatUrl} args={[splatMeshArgs]} />
          </group>
        </group>
      </SparkRenderer>
    </>
  );
};

export default App;
