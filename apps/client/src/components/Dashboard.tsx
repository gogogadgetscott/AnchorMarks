import { useEffect } from "react";
import { DashboardToolbar } from "./DashboardToolbar.tsx";
import { SmartInsights } from "./SmartInsights";
import { useUI } from "../contexts/UIContext";
import { useDashboard } from "../contexts/DashboardContext";
import * as legacyState from "@features/state.ts";

/**
 * Dashboard view component
 * Renders the dashboard with widgets using the legacy dashboard system
 */
export function Dashboard() {
  const { currentView } = useUI();
  const { dashboardWidgets } = useDashboard();

  useEffect(() => {
    let isCancelled = false;

    const syncAndRenderDashboard = async () => {
      if (currentView !== "dashboard") {
        const { unmountReactDashboard } = await import(
          "@features/bookmarks/react-dashboard.tsx"
        );
        if (!isCancelled) unmountReactDashboard();
        return;
      }

      // Keep legacy module state in sync until dashboard rendering is fully React-native.
      legacyState.setDashboardWidgets(dashboardWidgets);

      const { renderDashboard } = await import(
        "@features/bookmarks/dashboard.ts"
      );
      if (!isCancelled) {
        await renderDashboard();
      }
    };

    void syncAndRenderDashboard();

    return () => {
      isCancelled = true;
    };
  }, [currentView, dashboardWidgets]);

  return (
    <>
      <DashboardToolbar />
      <div id="main-view-outlet" className="dashboard-freeform"></div>
      <div
        className="dashboard-insights-section"
        style={{ marginTop: "2rem", padding: "1rem" }}
      >
      </div>
    </>
  );
}
