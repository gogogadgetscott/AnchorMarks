import { useEffect, useRef, useState } from "react";
import { useUI } from "@contexts/UIContext";
import { useModal } from "@contexts/ModalContext";

interface PopoverPosition {
  top: number;
  left: number;
}

function positionPopover(
  popoverEl: HTMLElement,
  targetEl: HTMLElement,
  position: string,
): PopoverPosition {
  const rect = targetEl.getBoundingClientRect();
  const popoverRect = popoverEl.getBoundingClientRect();
  const gap = 16;
  const minPadding = 16;
  let top: number;
  let left: number;

  if (position === "bottom") {
    top = rect.bottom + gap;
    left = rect.left + rect.width / 2 - popoverRect.width / 2;
  } else if (position === "top") {
    top = rect.top - popoverRect.height - gap;
    left = rect.left + rect.width / 2 - popoverRect.width / 2;
  } else if (position === "right") {
    top = rect.top + rect.height / 2 - popoverRect.height / 2;
    left = rect.right + gap;
  } else {
    // left
    top = rect.top + rect.height / 2 - popoverRect.height / 2;
    left = rect.left - popoverRect.width - gap;
  }

  left = Math.max(
    minPadding,
    Math.min(left, window.innerWidth - popoverRect.width - minPadding),
  );
  top = Math.max(
    minPadding,
    Math.min(top, window.innerHeight - popoverRect.height - minPadding),
  );

  return { top, left };
}

export function OnboardingTour() {
  const { tourState, setTourState, setTourCompleted } = useUI();
  const { closeModal } = useModal();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PopoverPosition>({ top: 80, left: 80 });

  const { active, currentStep, steps } = tourState;
  const step = steps[currentStep];

  // Reposition popover whenever the active step changes
  useEffect(() => {
    if (!active || !step || !popoverRef.current) return;

    const targetEl = document.getElementById(step.target);
    if (targetEl) {
      const computed = positionPopover(
        popoverRef.current,
        targetEl,
        step.position,
      );
      setPos(computed);
      targetEl.classList.add("tour-highlight");
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return () => {
      if (targetEl) targetEl.classList.remove("tour-highlight");
    };
  }, [active, currentStep, step]);

  const saveTourCompleted = async () => {
    try {
      const { saveSettings } = await import("@features/bookmarks/settings.ts");
      await saveSettings({ tour_completed: true });
      setTourCompleted(true);
    } catch {
      // Non-fatal
    }
  };

  const handleSkip = () => {
    setTourState({ ...tourState, active: false });
    closeModal();
    saveTourCompleted();
  };

  const handleNext = () => {
    const isLastStep = currentStep === steps.length - 1;
    if (isLastStep) {
      setTourState({ ...tourState, active: false });
      closeModal();
      saveTourCompleted();
    } else {
      setTourState({ ...tourState, currentStep: currentStep + 1 });
    }
  };

  if (!active || !step) return null;

  const isLastStep = currentStep === steps.length - 1;

  return (
    <>
      {/* Overlay */}
      <div id="tour-overlay" className="tour-overlay" aria-hidden="true" />

      {/* Popover */}
      <div
        id="tour-popover"
        className="tour-popover"
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        style={{ position: "fixed", top: pos.top, left: pos.left }}
      >
        <div className="tour-header">
          <div
            className="tour-steps"
            aria-label={`Step ${currentStep + 1} of ${steps.length}`}
          >
            {steps.map((_, i) => (
              <span
                key={i}
                className={`tour-step ${i === currentStep ? "active" : ""}`}
                id={`tour-step-${i + 1}`}
                aria-current={i === currentStep ? "step" : undefined}
              >
                {i + 1}
              </span>
            ))}
          </div>
          <button
            className="btn-icon tour-close"
            onClick={handleSkip}
            aria-label="Skip tour"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="tour-content">
          <h3 id="tour-title">{step.title}</h3>
          <p id="tour-description">{step.description}</p>
        </div>

        <div className="tour-actions">
          <button className="btn btn-secondary tour-skip" onClick={handleSkip}>
            Skip
          </button>
          <button
            className="btn btn-primary tour-next"
            id="tour-next-btn"
            onClick={handleNext}
          >
            {isLastStep ? "Got it!" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}
