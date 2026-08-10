import { describe, expect, it } from "vitest";
import { suiteLabel } from "./suite-tiers";

describe("suiteLabel", () => {
  it("names a saved regression suite truthfully", () => {
    expect(suiteLabel("regression", 1)).toBe("Regression suite · 1 saved scenario");
    expect(suiteLabel("regression", 4)).toBe("Regression suite · 4 saved scenarios");
  });
});
