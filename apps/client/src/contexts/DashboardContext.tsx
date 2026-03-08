import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import * as state from "../features/state.ts";
import { syncDashboardBridge } from "./context-bridge";
import type { DashboardWidget } from "../types/index";

interface DashboardConfig {
  mode: string;
  tags: string[];
  bookmarkSort: string;
}

interface DashboardState {
  dashboardConfig: DashboardConfig;
  dashboardWidgets: DashboardWidget[];
  widgetOrder: Record<string, number>;
  collapsedSections: string[];
  currentDashboardViewName: string | null;
  currentDashboardViewId: string | null;
  dashboardHasUnsavedChanges: boolean;
  savedDashboardState: string | null;
  currentDashboardTab: string | null;
  // Sidebar popout
  sidebarPopout: HTMLElement | null;
  popoutTimeout: ReturnType<typeof setTimeout> | null;
  tagSuggestTimeout: ReturnType<typeof setTimeout> | null;
}

interface DashboardActions {
  setDashboardConfig: (val: DashboardConfig) => void;
  setDashboardWidgets: (val: DashboardWidget[]) => void;
  setWidgetOrder: (val: Record<string, number>) => void;
  setCollapsedSections: (val: string[]) => void;
  setCurrentDashboardViewName: (val: string | null) => void;
  setCurrentDashboardViewId: (val: string | null) => void;
  setDashboardHasUnsavedChanges: (val: boolean) => void;
  setSavedDashboardState: (val: string | null) => void;
  setCurrentDashboardTab: (val: string | null) => void;
  setSidebarPopout: (val: HTMLElement | null) => void;
  setPopoutTimeout: (val: ReturnType<typeof setTimeout> | null) => void;
  setTagSuggestTimeout: (val: ReturnType<typeof setTimeout> | null) => void;
}

type DashboardContextValue = DashboardState & DashboardActions;

const DashboardContext = createContext<DashboardContextValue | null>(null);

const defaultDashboardConfig: DashboardConfig = {
  mode: "folder",
  tags: [],
  bookmarkSort: "recently_added",
};

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>(
    defaultDashboardConfig,
  );
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>(
    [],
  );
  const [widgetOrder, setWidgetOrder] = useState<Record<string, number>>({});
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
  const [currentDashboardViewName, setCurrentDashboardViewName] = useState<
    string | null
  >(null);
  const [currentDashboardViewId, setCurrentDashboardViewId] = useState<
    string | null
  >(null);
  const [dashboardHasUnsavedChanges, setDashboardHasUnsavedChanges] =
    useState(false);
  const [savedDashboardState, setSavedDashboardState] = useState<string | null>(
    null,
  );
  const [currentDashboardTab, setCurrentDashboardTab] = useState<string | null>(
    null,
  );
  const [sidebarPopout, setSidebarPopout] = useState<HTMLElement | null>(null);
  const [popoutTimeout, setPopoutTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [tagSuggestTimeout, setTagSuggestTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  useEffect(() => {
    return state.subscribe((key, value) => {
      switch (key) {
        case "dashboardConfig":
          setDashboardConfig(value as DashboardConfig);
          break;
        case "dashboardWidgets":
          setDashboardWidgets(value as DashboardWidget[]);
          break;
        case "widgetOrder":
          setWidgetOrder(value as Record<string, number>);
          break;
        case "collapsedSections":
          setCollapsedSections(value as string[]);
          break;
        case "currentDashboardViewName":
          setCurrentDashboardViewName(value as string | null);
          break;
        case "currentDashboardViewId":
          setCurrentDashboardViewId(value as string | null);
          break;
        case "dashboardHasUnsavedChanges":
          setDashboardHasUnsavedChanges(value as boolean);
          break;
        case "savedDashboardState":
          setSavedDashboardState(value as string | null);
          break;
        case "currentDashboardTab":
          setCurrentDashboardTab(value as string | null);
          break;
        case "sidebarPopout":
          setSidebarPopout(value as HTMLElement | null);
          break;
        case "popoutTimeout":
          setPopoutTimeout(value as any);
          break;
        case "tagSuggestTimeout":
          setTagSuggestTimeout(value as any);
          break;
      }
    });
  }, []);

  // Sync into bridge so non-React code (settings.ts restore) can write directly to context
  useEffect(() => {
    syncDashboardBridge({
      setDashboardConfig,
      setDashboardWidgets,
      setWidgetOrder,
      setCollapsedSections,
      setCurrentDashboardViewId,
      setCurrentDashboardViewName,
    });
  }, []);

  const value: DashboardContextValue = {
    dashboardConfig,
    dashboardWidgets,
    widgetOrder,
    collapsedSections,
    currentDashboardViewName,
    currentDashboardViewId,
    dashboardHasUnsavedChanges,
    savedDashboardState,
    currentDashboardTab,
    sidebarPopout,
    popoutTimeout,
    tagSuggestTimeout,
    setDashboardConfig: useCallback((val) => setDashboardConfig(val), []),
    setDashboardWidgets: useCallback((val) => setDashboardWidgets(val), []),
    setWidgetOrder: useCallback((val) => setWidgetOrder(val), []),
    setCollapsedSections: useCallback((val) => setCollapsedSections(val), []),
    setCurrentDashboardViewName: useCallback(
      (val) => setCurrentDashboardViewName(val),
      [],
    ),
    setCurrentDashboardViewId: useCallback(
      (val) => setCurrentDashboardViewId(val),
      [],
    ),
    setDashboardHasUnsavedChanges: useCallback(
      (val) => setDashboardHasUnsavedChanges(val),
      [],
    ),
    setSavedDashboardState: useCallback(
      (val) => setSavedDashboardState(val),
      [],
    ),
    setCurrentDashboardTab: useCallback(
      (val) => setCurrentDashboardTab(val),
      [],
    ),
    setSidebarPopout: useCallback((val) => setSidebarPopout(val), []),
    setPopoutTimeout: useCallback((val) => setPopoutTimeout(val), []),
    setTagSuggestTimeout: useCallback((val) => setTagSuggestTimeout(val), []),
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx)
    throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
