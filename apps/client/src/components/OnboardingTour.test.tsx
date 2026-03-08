import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingTour } from "./OnboardingTour";

const mockSetTourState = vi.fn();
const mockSetTourCompleted = vi.fn();
const mockCloseModal = vi.fn();

const defaultTourSteps = [
  {
    title: "Step 1 Title",
    description: "Step 1 description",
    target: "step-1-target",
    position: "bottom" as const,
  },
  {
    title: "Step 2 Title",
    description: "Step 2 description",
    target: "step-2-target",
    position: "right" as const,
  },
  {
    title: "Step 3 Title",
    description: "Step 3 done",
    target: "step-3-target",
    position: "top" as const,
  },
];

let mockTourState = {
  active: false,
  currentStep: 0,
  steps: defaultTourSteps,
};

vi.mock("@contexts/UIContext", () => ({
  useUI: () => ({
    tourState: mockTourState,
    setTourState: mockSetTourState,
    setTourCompleted: mockSetTourCompleted,
  }),
}));

vi.mock("@contexts/ModalContext", () => ({
  useModal: () => ({
    closeModal: mockCloseModal,
  }),
}));

// SaveSettings is dynamically imported — mock the module
vi.mock("@features/bookmarks/settings.ts", () => ({
  saveSettings: vi.fn().mockResolvedValue(undefined),
}));

describe("OnboardingTour (React)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTourState = {
      active: false,
      currentStep: 0,
      steps: defaultTourSteps,
    };
  });

  it("renders nothing when tour is not active", () => {
    render(<OnboardingTour />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.getElementById("tour-overlay")).toBeNull();
  });

  it("renders overlay and popover when active", () => {
    mockTourState = { ...mockTourState, active: true };
    render(<OnboardingTour />);
    expect(document.getElementById("tour-overlay")).toBeTruthy();
    expect(document.getElementById("tour-popover")).toBeTruthy();
  });

  it("displays current step title and description", () => {
    mockTourState = { ...mockTourState, active: true, currentStep: 0 };
    render(<OnboardingTour />);
    expect(screen.getByText("Step 1 Title")).toBeTruthy();
    expect(screen.getByText("Step 1 description")).toBeTruthy();
  });

  it("shows step indicators for each step", () => {
    mockTourState = { ...mockTourState, active: true };
    render(<OnboardingTour />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("marks current step indicator as active", () => {
    mockTourState = { ...mockTourState, active: true, currentStep: 1 };
    render(<OnboardingTour />);
    const stepIndicators = document.querySelectorAll(".tour-step");
    expect(stepIndicators[1].classList.contains("active")).toBe(true);
    expect(stepIndicators[0].classList.contains("active")).toBe(false);
  });

  it("shows 'Next' on non-final steps", () => {
    mockTourState = { ...mockTourState, active: true, currentStep: 0 };
    render(<OnboardingTour />);
    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("shows 'Got it!' on final step", () => {
    mockTourState = {
      ...mockTourState,
      active: true,
      currentStep: defaultTourSteps.length - 1,
    };
    render(<OnboardingTour />);
    expect(screen.getByText("Got it!")).toBeTruthy();
  });

  it("renders Skip button", () => {
    mockTourState = { ...mockTourState, active: true };
    render(<OnboardingTour />);
    expect(screen.getByText("Skip")).toBeTruthy();
  });

  it("calls setTourState with active=false when Skip is clicked", () => {
    mockTourState = { ...mockTourState, active: true };
    render(<OnboardingTour />);
    fireEvent.click(screen.getByText("Skip"));
    expect(mockSetTourState).toHaveBeenCalledWith(
      expect.objectContaining({ active: false }),
    );
  });

  it("advances to next step when Next is clicked", () => {
    mockTourState = { ...mockTourState, active: true, currentStep: 0 };
    render(<OnboardingTour />);
    fireEvent.click(screen.getByText("Next"));
    expect(mockSetTourState).toHaveBeenCalledWith(
      expect.objectContaining({ currentStep: 1 }),
    );
  });

  it("closes tour on final step when 'Got it!' is clicked", () => {
    mockTourState = {
      ...mockTourState,
      active: true,
      currentStep: defaultTourSteps.length - 1,
    };
    render(<OnboardingTour />);
    fireEvent.click(screen.getByText("Got it!"));
    expect(mockSetTourState).toHaveBeenCalledWith(
      expect.objectContaining({ active: false }),
    );
  });

  it("has dialog role when active", () => {
    mockTourState = { ...mockTourState, active: true };
    render(<OnboardingTour />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("close button skips tour", () => {
    mockTourState = { ...mockTourState, active: true };
    render(<OnboardingTour />);
    const closeBtn = screen.getByLabelText("Skip tour");
    fireEvent.click(closeBtn);
    expect(mockSetTourState).toHaveBeenCalledWith(
      expect.objectContaining({ active: false }),
    );
  });
});
