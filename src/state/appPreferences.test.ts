import { describe, expect, it } from "vitest";
import { DEFAULT_APP_PREFERENCES, sanitizeAppPreferences } from "@/state/appPreferences";

describe("app preferences", () => {
  it("defaults ignore color to off", () => {
    expect(DEFAULT_APP_PREFERENCES.ignoreColor).toBe(false);
    expect(sanitizeAppPreferences({}).ignoreColor).toBe(false);
  });

  it("preserves ignore color when stored", () => {
    expect(sanitizeAppPreferences({ ignoreColor: true }).ignoreColor).toBe(true);
  });
});
