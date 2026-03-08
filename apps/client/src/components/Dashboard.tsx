import { useEffect } from "react";
import { DashboardToolbar } from "./DashboardToolbar.tsx";
import { SmartInsights } from "./SmartInsights";
import { useUI } from "../contexts/UIContext";

/**
 * Dashboard view component
 * Renders the dashboard with widgets using the legacy dashboard system
 */
export function Dashboard() {
  const { currentView } = useUI();

  useEffect(() => {
    // Dashboard uses React to render itself; no manual call needed
  }, [currentView]);

  return (
    <>
      <DashboardToolbar />
      <div id="main-view-outlet" className="dashboard-freeform"></div>
      <div
        className="dashboard-insights-section"
        style={{ marginTop: "2rem", padding: "1rem" }}
      >
        <SmartInsights enabled={currentView === "dashboard"} />
      </div>
    </>
  );
}
