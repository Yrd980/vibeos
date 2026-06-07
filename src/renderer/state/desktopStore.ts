import { create } from 'zustand';
import type { GeneratedUiBlock, GenerateUiResult } from '../../shared/types';

export interface DesktopWindow {
  windowId: string;
  appSessionId: string;
  appName: string;
  title: string;
  blocks: GeneratedUiBlock[];
  state: unknown;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
  loading: boolean;
  narration?: string | null;
}

interface DesktopStore {
  windows: DesktopWindow[];
  recentGeneratedApps: string[];
  nextZIndex: number;
  startMenuOpen: boolean;
  addWindow(window: Omit<DesktopWindow, 'zIndex'>): void;
  recordGeneratedAppLaunch(appName: string): void;
  updateWindow(windowId: string, patch: Partial<DesktopWindow>): void;
  updateWindowResult(windowId: string, result: GenerateUiResult): void;
  focusWindow(windowId: string): void;
  closeWindow(windowId: string): void;
  minimizeWindow(windowId: string): void;
  restoreWindow(windowId: string): void;
  toggleMaximize(windowId: string): void;
  setStartMenuOpen(open: boolean): void;
}

const RECENT_GENERATED_APP_LIMIT = 6;

export const useDesktopStore = create<DesktopStore>((set, get) => ({
  windows: [],
  recentGeneratedApps: [],
  nextZIndex: 10,
  startMenuOpen: false,

  addWindow(window) {
    const zIndex = get().nextZIndex;
    set((state) => ({
      windows: [...state.windows, { ...window, zIndex }],
      nextZIndex: zIndex + 1,
      startMenuOpen: false
    }));
  },

  recordGeneratedAppLaunch(appName) {
    const normalizedAppName = appName.trim();
    if (!normalizedAppName) {
      return;
    }

    set((state) => ({
      recentGeneratedApps: [
        normalizedAppName,
        ...state.recentGeneratedApps.filter(
          (recentAppName) => recentAppName.toLowerCase() !== normalizedAppName.toLowerCase()
        )
      ].slice(0, RECENT_GENERATED_APP_LIMIT)
    }));
  },

  updateWindow(windowId, patch) {
    set((state) => ({
      windows: state.windows.map((window) => (window.windowId === windowId ? { ...window, ...patch } : window))
    }));
  },

  updateWindowResult(windowId, result) {
    set((state) => ({
      windows: state.windows.map((window) =>
        window.windowId === windowId
          ? {
              ...window,
              title: result.title,
              blocks: result.blocks,
              state: result.state,
              narration: result.narration ?? null,
              loading: false
            }
          : window
      )
    }));
  },

  focusWindow(windowId) {
    const zIndex = get().nextZIndex;
    set((state) => ({
      windows: state.windows.map((window) =>
        window.windowId === windowId ? { ...window, minimized: false, zIndex } : window
      ),
      nextZIndex: zIndex + 1
    }));
  },

  closeWindow(windowId) {
    set((state) => ({ windows: state.windows.filter((window) => window.windowId !== windowId) }));
  },

  minimizeWindow(windowId) {
    set((state) => ({
      windows: state.windows.map((window) => (window.windowId === windowId ? { ...window, minimized: true } : window))
    }));
  },

  restoreWindow(windowId) {
    get().focusWindow(windowId);
  },

  toggleMaximize(windowId) {
    get().focusWindow(windowId);
    set((state) => ({
      windows: state.windows.map((window) =>
        window.windowId === windowId ? { ...window, maximized: !window.maximized, minimized: false } : window
      )
    }));
  },

  setStartMenuOpen(open) {
    set({ startMenuOpen: open });
  }
}));
