import { CameraControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { type Group, Matrix4, Quaternion, Vector3 } from "three";
import type { WebGLRenderer } from "three";
import type { PerformanceSettings } from "../viewer-config";
import { SparkRenderer } from "./spark/SparkRenderer";
import { SplatMesh } from "./spark/SplatMesh";

type ViewerSceneProps = {
  onFpsChange: (fps: number) => void;
  onRendererReady: (renderer: WebGLRenderer | null) => void;
  performance: PerformanceSettings;
  splatUrl: string;
  xrActive: boolean;
};

export function ViewerScene({
  onFpsChange,
  onRendererReady,
  performance,
  splatUrl,
  xrActive,
}: ViewerSceneProps) {
  const renderer = useThree((state) => state.gl);
  const splatRootRef = useRef<Group>(null);
  const fpsSampleRef = useRef({
    elapsed: 0,
    frames: 0,
  });
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

  useEffect(() => {
    return () => {
      onFpsChange(0);
    };
  }, [onFpsChange]);

  const sparkRendererArgs = useMemo(() => {
    return {
      behindFoveate: performance.behindFoveate,
      coneFov: 120,
      coneFov0: 85,
      coneFoveate: performance.coneFoveate,
      enableLod: true,
      lodRenderScale: performance.lodRenderScale,
      lodSplatCount: performance.lodSplatCount,
      maxStdDev: performance.maxStdDev,
      renderer,
    };
  }, [performance, renderer]);

  const splatMeshArgs = useMemo(
    () =>
      ({
        lod: true,
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

  useFrame((_, delta, frame) => {
    const fpsSample = fpsSampleRef.current;
    fpsSample.elapsed += delta;
    fpsSample.frames += 1;

    if (fpsSample.elapsed >= 0.25) {
      onFpsChange(fpsSample.frames / fpsSample.elapsed);
      fpsSample.elapsed = 0;
      fpsSample.frames = 0;
    }

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
}
