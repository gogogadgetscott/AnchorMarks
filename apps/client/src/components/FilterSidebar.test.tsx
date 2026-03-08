import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterSidebar } from "./FilterSidebar";
import { ModalProvider } from "@contexts/ModalContext";
import type { FilterConfig } from "../types/index";

const mockFilterConfig: FilterConfig = {
  sort: "recently_added",
  tags: [],
  tagSort: "count_desc",
  tagMode: "OR",
};

const mockSetFilterConfig = vi.fn();

vi.mock("@contexts/BookmarksContext", () => ({
  useBookmarks: () => ({
    filterConfig: mockFilterConfig,
    setFilterConfig: mockSetFilterConfig,
    tagMetadata: {
      javascript: { count: 12, color: "#6366f1" },
      react: { count: 8, color: "#0ea5e9" },
      typescript: { count: 5 },
    },
  }),
}));

vi.mock("@utils/modal-controller", () => ({
  registerModalDispatcher: vi.fn(),
}));

describe("FilterSidebar (React)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSidebar = () => {
    return render(
      <ModalProvider>
        <FilterSidebar />
      </ModalProvider>,
    );
  };

  it("renders the sidebar with heading", () => {
    renderSidebar();
    expect(screen.getByText("Filters & Sort")).toBeTruthy();
  });

  it("renders close button with accessible label", () => {
    renderSidebar();
    const closeBtn = screen.getByLabelText("Close filter sidebar");
    expect(closeBtn).toBeTruthy();
  });

  it("renders Sort Bookmarks section", () => {
    const { container } = renderSidebar();
    expect(screen.getByText("Sort Bookmarks")).toBeTruthy();
    expect(container.querySelector("#filter-sort")).toBeTruthy();
  });

  it("renders all sort options", () => {
    renderSidebar();
    expect(screen.getByText("Recently Added")).toBeTruthy();
    expect(screen.getByText("Oldest First")).toBeTruthy();
    expect(screen.getByText("Most Visited")).toBeTruthy();
    expect(screen.getByText("A – Z")).toBeTruthy();
    expect(screen.getByText("Z – A")).toBeTruthy();
  });

  it("renders Sort Tags section with options", () => {
    renderSidebar();
    expect(screen.getByText("Sort Tags")).toBeTruthy();
    expect(screen.getByText("Most Used First")).toBeTruthy();
    expect(screen.getByText("A → Z")).toBeTruthy();
  });

  it("shows 'No filters active' when no tags selected", () => {
    renderSidebar();
    expect(screen.getByText("No filters active")).toBeTruthy();
  });

  it("renders available tags from tagMetadata", () => {
    renderSidebar();
    expect(screen.getByText("javascript")).toBeTruthy();
    expect(screen.getByText("react")).toBeTruthy();
    expect(screen.getByText("typescript")).toBeTruthy();
  });

  it("renders tag count badges", () => {
    renderSidebar();
    // Count "12" for javascript tag
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
  });

  it("calls setFilterConfig when sort changes", () => {
    renderSidebar();
    const sortSelects = screen.getAllByRole("combobox");
    fireEvent.change(sortSelects[0], { target: { value: "a_z" } });
    expect(mockSetFilterConfig).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "a_z" }),
    );
  });

  it("calls setFilterConfig when tag sort changes", () => {
    renderSidebar();
    const sortSelects = screen.getAllByRole("combobox");
    fireEvent.change(sortSelects[1], { target: { value: "name_asc" } });
    expect(mockSetFilterConfig).toHaveBeenCalledWith(
      expect.objectContaining({ tagSort: "name_asc" }),
    );
  });

  it("filters tag list by search input", () => {
    renderSidebar();
    const searchInput = screen.getByPlaceholderText("Search tags…");
    fireEvent.change(searchInput, { target: { value: "java" } });
    expect(screen.getByText("javascript")).toBeTruthy();
    expect(screen.queryByText("react")).toBeNull();
  });

  it("has accessible landmark role", () => {
    renderSidebar();
    const sidebar = screen.getByRole("complementary");
    expect(sidebar).toBeTruthy();
  });

  it("has filter-sidebar id", () => {
    const { container } = renderSidebar();
    expect(container.querySelector("#filter-sidebar")).toBeTruthy();
  });
});
