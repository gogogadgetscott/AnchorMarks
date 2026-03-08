import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
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
  // Drag/resize state — will move to a dedicated hook once dashboard is ported
  draggedWidget: HTMLElement | null;
  isDraggingWidget: boolean;
  dragStartPos: { x: number; y: number };
  widgetStartPos: { x: number; y: number };
  isResizing: boolean;
  resizingWidget: HTMLElement | null;
  resizeStartSize: { w: number; h: number };
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
  setDraggedWidget: (val: HTMLElement | null) => void;
  setIsDraggingWidget: (val: boolean) => void;
  setDragStartPos: (val: { x: number; y: number }) => void;
  setWidgetStartPos: (val: { x: number; y: number }) => void;
  setIsResizing: (val: boolean) => void;
  setResizingWidget: (val: HTMLElement | null) => void;
  setResizeStartSize: (val: { w: number; h: number }) => void;
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
  const [draggedWidget, setDraggedWidget] = useState<HTMLElement | null>(null);
  const [isDraggingWidget, setIsDraggingWidget] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [widgetStartPos, setWidgetStartPos] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizingWidget, setResizingWidget] = useState<HTMLElement | null>(
    null,
  );
  const [resizeStartSize, setResizeStartSize] = useState({ w: 0, h: 0 });
  const [sidebarPopout, setSidebarPopout] = useState<HTMLElement | null>(null);
  const [popoutTimeout, setPopoutTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [tagSuggestTimeout, setTagSuggestTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

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
    draggedWidget,
    isDraggingWidget,
    dragStartPos,
    widgetStartPos,
    isResizing,
    resizingWidget,
    resizeStartSize,
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
    setDraggedWidget: useCallback((val) => setDraggedWidget(val), []),
    setIsDraggingWidget: useCallback((val) => setIsDraggingWidget(val), []),
    setDragStartPos: useCallback((val) => setDragStartPos(val), []),
    setWidgetStartPos: useCallback((val) => setWidgetStartPos(val), []),
    setIsResizing: useCallback((val) => setIsResizing(val), []),
    setResizingWidget: useCallback((val) => setResizingWidget(val), []),
    setResizeStartSize: useCallback((val) => setResizeStartSize(val), []),
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
