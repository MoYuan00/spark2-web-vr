export type PerformanceSettings = {
  behindFoveate: number;
  coneFoveate: number;
  lodRenderScale: number;
  lodSplatCount: number;
  maxStdDev: number;
  pixelRatio: number;
};

export const DEFAULT_PERFORMANCE_SETTINGS: PerformanceSettings = {
  behindFoveate: 0.15,
  coneFoveate: 0.35,
  lodRenderScale: 1.75,
  lodSplatCount: 1000000,
  maxStdDev: Math.sqrt(5),
  pixelRatio: 1,
};

export type AvailableSplat = {
  label: string;
  name: string;
  url: string;
};

export type SplatSection = {
  items: AvailableSplat[];
  title: string;
};

export const SPLAT_SECTIONS: SplatSection[] = [
  {
    title: "精选",
    items: [
      {
        label: "Butterfly",
        name: "butterfly.spz",
        url: "/assets/splats/butterfly.spz",
      },
      {
        label: "室内-树-spz",
        name: "2.spz",
        url: "/assets/splats/hometree.spz",
      },
      {
        label: "花-天空",
        name: "3-180.ply",
        url: "/assets/splats/3-180.ply",
      },
      {
        label: "室内-树",
        name: "2.ply",
        url: "/assets/splats/2-export.ply",
      },
      {
        label: "梵高风格室内",
        name: "梵高风格室内.ply",
        url: "/assets/splats/梵高风格室内.ply",
      },
      {
        label: "极简建筑空间",
        name: "极简建筑空间_Choose.ply",
        url: "/assets/splats/极简建筑空间_Choose.ply",
      },
      {
        label: "色块风格室内",
        name: "色块风格室内_Choose.ply",
        url: "/assets/splats/色块风格室内_Choose.ply",
      },
      {
        label: "书架落地窗场景_Choose",
        name: "书架落地窗场景_Choose.ply",
        url: "/assets/splats/书架落地窗场景_Choose.ply",
      },
      {
        label: "水彩风格室内",
        name: "水彩风格室内.ply",
        url: "/assets/splats/水彩风格室内.ply",
      },
      {
        label: "2",
        name: "2.sog",
        url: "/assets/splats/2.sog",
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

export const DEFAULT_SPLAT =
  ALL_AVAILABLE_SPLATS.find((item) => item.name === "butterfly.spz") ??
  ALL_AVAILABLE_SPLATS[0];

if (!DEFAULT_SPLAT) {
  throw new Error("No SPZ assets configured.");
}

export const DEFAULT_SPLAT_URL = DEFAULT_SPLAT.url;
export const DEFAULT_SPLAT_NAME = DEFAULT_SPLAT.name;
export const XR_SESSION_MODES = ["immersive-vr", "immersive-ar"] as const;

export type XrSessionMode = (typeof XR_SESSION_MODES)[number];

export const XR_SESSION_OPTIONS: XRSessionInit = {
  optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking", "layers"],
};
