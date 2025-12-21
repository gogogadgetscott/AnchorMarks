import React, { memo, useEffect } from "react";
import { Icon } from "../components/Icon";
import { Button } from "../components/Button";
import { startTour, skipTour, nextTourStep } from "@features/bookmarks/tour.ts";

export const OnboardingTour = memo(() => {
  useEffect(() => {
    (window as any).startTour = startTour;
    (window as any).skipTour = skipTour;
    (window as any).nextTourStep = nextTourStep;

    return () => {
      delete (window as any).startTour;
      delete (window as any).skipTour;
      delete (window as any).nextTourStep;
    };
  }, []);

  return (
    <>
      <div id="tour-overlay" className="tour-overlay hidden"></div>
      <div id="tour-popover" className="tour-popover hidden">
        <div className="tour-header">
          <div className="tour-steps">
            <span className="tour-step" id="tour-step-1">
              1
            </span>
            <span className="tour-step" id="tour-step-2">
              2
            </span>
            <span className="tour-step" id="tour-step-3">
              3
            </span>
          </div>
          <button
            className="btn-icon tour-close"
            data-action="skip-tour"
            onClick={skipTour}
            aria-label="Skip tour"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="tour-content">
          <h3 id="tour-title"></h3>
          <p id="tour-description"></p>
        </div>
        <div className="tour-actions">
          <Button
            className="tour-skip"
            variant="secondary"
            onClick={skipTour}
            data-action="skip-tour"
          >
            Skip
          </Button>
          <Button
            className="tour-next"
            id="tour-next-btn"
            variant="primary"
            onClick={nextTourStep}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
});

OnboardingTour.displayName = "OnboardingTour";
