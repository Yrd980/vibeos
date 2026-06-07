export const APP_NAMES = {
  CALCULATOR: 'Calculator',
  NOTEPAD: 'Notepad',
  BROWSER: 'Browser',
  FILE_EXPLORER: 'File Explorer',
  TERMINAL: 'Terminal',
  ENCARTA_98: 'Encarta 98',
  PAINT: 'Paint',
  SETTINGS: 'Settings'
} as const;

const COMPACT_WINDOW_SIZE = { width: 520, height: 380 } as const;
const LARGE_WINDOW_SIZE = { width: 720, height: 460 } as const;

export const APP_CATALOG = [
  {
    appName: APP_NAMES.CALCULATOR,
    icon: 'C',
    localRuntime: true,
    showOnDesktop: true,
    windowSize: COMPACT_WINDOW_SIZE
  },
  {
    appName: APP_NAMES.NOTEPAD,
    icon: 'N',
    localRuntime: true,
    showOnDesktop: true,
    windowSize: COMPACT_WINDOW_SIZE
  },
  {
    appName: APP_NAMES.BROWSER,
    icon: 'B',
    localRuntime: true,
    showOnDesktop: true,
    windowSize: LARGE_WINDOW_SIZE
  },
  {
    appName: APP_NAMES.FILE_EXPLORER,
    icon: 'F',
    localRuntime: false,
    showOnDesktop: true,
    windowSize: COMPACT_WINDOW_SIZE
  },
  {
    appName: APP_NAMES.TERMINAL,
    icon: 'T',
    localRuntime: false,
    showOnDesktop: true,
    windowSize: COMPACT_WINDOW_SIZE
  },
  {
    appName: APP_NAMES.ENCARTA_98,
    icon: 'E',
    localRuntime: false,
    showOnDesktop: true,
    windowSize: LARGE_WINDOW_SIZE
  },
  {
    appName: APP_NAMES.PAINT,
    icon: 'P',
    localRuntime: false,
    showOnDesktop: false,
    windowSize: COMPACT_WINDOW_SIZE
  },
  {
    appName: APP_NAMES.SETTINGS,
    icon: 'S',
    localRuntime: false,
    showOnDesktop: false,
    windowSize: COMPACT_WINDOW_SIZE
  }
] as const;

export const ASK_VIBEOS_EXAMPLES = [
  'Encarta 98 about Mark Russinovich',
  'Commander XE but rude',
  'Microsoft Money 95 for Scott Hanselman',
  'Paint with a normal picture of Scott Hanselman',
  'Nested OS simulator'
] as const;

type AppCatalogEntry = (typeof APP_CATALOG)[number];
type LocalRuntimeAppCatalogEntry = Extract<AppCatalogEntry, { readonly localRuntime: true }>;

export type BuiltInAppName = AppCatalogEntry['appName'];
export type LocalRuntimeAppName = LocalRuntimeAppCatalogEntry['appName'];
export type AppWindowSize = {
  width: number;
  height: number;
};

export const BUILT_IN_APP_NAMES: readonly BuiltInAppName[] = APP_CATALOG.map((app) => app.appName);
export const DESKTOP_APP_NAMES: readonly BuiltInAppName[] = APP_CATALOG.filter((app) => app.showOnDesktop).map(
  (app) => app.appName
);
export const LOCAL_RUNTIME_APP_NAMES: readonly LocalRuntimeAppName[] = APP_CATALOG.filter(
  isLocalRuntimeAppCatalogEntry
).map((app) => app.appName);
export const APP_ICONS: Record<string, string> = Object.fromEntries(APP_CATALOG.map((app) => [app.appName, app.icon]));

export function isBuiltInApp(appName: string): appName is BuiltInAppName {
  return BUILT_IN_APP_NAMES.includes(appName as BuiltInAppName);
}

export function matchesBuiltInAppName(appName: string): boolean {
  return BUILT_IN_APP_NAMES.some((builtInAppName) => builtInAppName.toLowerCase() === appName.toLowerCase());
}

export function isLocalRuntimeAppName(appName: string): appName is LocalRuntimeAppName {
  return LOCAL_RUNTIME_APP_NAMES.includes(appName as LocalRuntimeAppName);
}

export function getAppIcon(appName: string, fallback = 'A'): string {
  return APP_ICONS[appName] ?? fallback;
}

export function getInitialWindowSize(appName: string): AppWindowSize {
  return findAppCatalogEntry(appName)?.windowSize ?? LARGE_WINDOW_SIZE;
}

function findAppCatalogEntry(appName: string): AppCatalogEntry | undefined {
  return APP_CATALOG.find((app) => app.appName === appName);
}

function isLocalRuntimeAppCatalogEntry(app: AppCatalogEntry): app is LocalRuntimeAppCatalogEntry {
  return app.localRuntime;
}
