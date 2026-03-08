import { createPortal } from "react-dom";
import { useModal } from "@contexts/ModalContext";
import BookmarkModal from "./BookmarkModal";
import TagModal from "./TagModal";
import FolderModal from "./FolderModal";
import SettingsModal from "./SettingsModal";
import { FilterSidebar } from "../FilterSidebar";
import { OnboardingTour } from "../OnboardingTour";

/**
 * ModalPortal renders all modals via React portals at the app root.
 * Individual modals are conditionally rendered based on the ModalContext state.
 *
 * This replaces the old HTML fragments + innerHTML injection pattern.
 */
export function ModalPortal() {
  const { openModal } = useModal();

  // Get or create portal container
  const getPortalContainer = (): HTMLElement => {
    let container = document.getElementById("modal-portal");
    if (!container) {
      container = document.createElement("div");
      container.id = "modal-portal";
      document.body.appendChild(container);
    }
    return container;
  };

  const portalContainer = getPortalContainer();

  return createPortal(
    <>
      {openModal === "bookmark" && <BookmarkModal />}
      {openModal === "tag" && <TagModal />}
      {openModal === "folder" && <FolderModal />}
      {openModal === "settings" && <SettingsModal />}
      {openModal === "filter" && <FilterSidebar />}
      {openModal === "tour" && <OnboardingTour />}
    </>,
    portalContainer,
  );
}
