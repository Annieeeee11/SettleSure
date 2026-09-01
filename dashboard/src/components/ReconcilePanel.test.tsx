// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReconcilePanel from "./ReconcilePanel";

vi.mock("../lib/api", () => ({
  health: vi.fn().mockResolvedValue({ status: "ok", version: "2.0.0" }),
  reconcile: vi.fn(),
}));

afterEach(cleanup);

describe("ReconcilePanel", () => {
  it("shows live API state and judge entry points", async () => {
    render(
      <ReconcilePanel mode="benchmark" onComplete={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: "Run live sample" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Reconcile uploaded CSVs" }),
    ).toBeDisabled();
    expect(screen.getByText("Benchmark view")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/API online · v2.0.0/)).toBeTruthy();
    });
  });
});
