import { describe, it, expect } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("returns fallback for empty input", () => {
    expect(safeNextPath(null)).toBe("/chat");
    expect(safeNextPath(undefined)).toBe("/chat");
    expect(safeNextPath("")).toBe("/chat");
  });

  it("allows safe relative paths", () => {
    expect(safeNextPath("/library")).toBe("/library");
    expect(safeNextPath("/chat/abc")).toBe("/chat/abc");
  });

  it("blocks open redirects", () => {
    expect(safeNextPath("//evil.com")).toBe("/chat");
    expect(safeNextPath("https://evil.com")).toBe("/chat");
  });
});
