import { useState } from "react";
import { useFolders } from "@contexts/FoldersContext";
import { Icon } from "@components/Icon.tsx";
import { FolderTreePanel } from "./FolderTreePanel";
import { BulkReorganizePanel } from "./BulkReorganizeModal";

type Tab = "tree" | "bulk";

export function FolderOrganizerView() {
  const { folders, isLoading } = useFolders();
  const [activeTab, setActiveTab] = useState<Tab>("tree");

  if (isLoading) {
    return (
      <div className="fo-loading">
        <Icon name="folder" size={32} />
        <p>Loading folders…</p>
      </div>
    );
  }

  return (
    <div className="fo-root">
      <div className="fo-header">
        <div className="fo-header-left">
          <Icon name="folder" size={20} />
          <h1 className="fo-title">Folder Organizer</h1>
          <span className="badge">{folders.length}</span>
        </div>

        <p className="fo-subtitle">
          Drag folders into a hierarchy, bulk-move selections, or edit metadata.
        </p>
      </div>

      {/* Tab bar */}
      <div className="fo-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "tree"}
          className={`fo-tab ${activeTab === "tree" ? "fo-tab--active" : ""}`}
          onClick={() => setActiveTab("tree")}
        >
          <Icon name="layout" size={15} />
          Tree View
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "bulk"}
          className={`fo-tab ${activeTab === "bulk" ? "fo-tab--active" : ""}`}
          onClick={() => setActiveTab("bulk")}
        >
          <Icon name="check-square" size={15} />
          Bulk Reorganize
        </button>
      </div>

      {/* Tab content */}
      <div className="fo-content">
        {activeTab === "tree" && <FolderTreePanel />}
        {activeTab === "bulk" && <BulkReorganizePanel />}
      </div>
    </div>
  );
}
