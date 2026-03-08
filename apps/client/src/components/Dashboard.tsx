import { useEffect } from "react";
import { DashboardToolbar } from "./DashboardToolbar.tsx";
import { renderDashboard } from "@features/bookmarks/dashboard.ts";
import { useUI } from "../contexts/UIContext";

/**
 * Dashboard view component
 * Renders the dashboard with widgets using the legacy dashboard system
 */
export function Dashboard() {
  const { currentView } = useUI();

  useEffect(() => {
    // Render dashboard when the component mounts or currentView changes to dashboard
    if (currentView === "dashboard") {
      void renderDashboard();
    }
  }, [currentView]);

  return (
    <>
      <DashboardToolbar />
      <div id="main-view-outlet" className="dashboard-freeform"></div>
    </>
  );
}
