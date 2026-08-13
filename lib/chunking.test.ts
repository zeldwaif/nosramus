import { describe, it, expect } from "vitest";
import { chunkPages, estimateTokens } from "./chunking";

describe("estimateTokens", () => {
  it("estimates from character length", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(8))).toBe(2);
  });
});

describe("chunkPages", () => {
  it("tracks section headings", () => {
    const chunks = chunkPages([
      {
        page: 1,
        text: "Introduction\n\nThis paper presents a method.\n\nMethods\n\nWe trained a model.",
      },
    ]);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const methods = chunks.find((c) => c.section === "methods");
    expect(methods).toBeDefined();
    expect(methods!.content).toMatch(/trained a model/i);
  });

  it("preserves page numbers", () => {
    const chunks = chunkPages([
      { page: 3, text: "Results\n\nAccuracy was 95% on the benchmark." },
    ]);
    expect(chunks[0]?.page).toBe(3);
  });

  it("returns empty for blank pages", () => {
    expect(chunkPages([{ page: 1, text: "   \n\n  " }])).toEqual([]);
  });

  it("respects token budget by splitting into multiple chunks", () => {
    const longPara = "Word ".repeat(400).trim();
    const chunks = chunkPages(
      [{ page: 1, text: `Introduction\n\n${longPara}\n\n${longPara}` }],
      { targetTokens: 100, overlapTokens: 20 }
    );
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.token_count).toBeLessThanOrEqual(200);
    }
  });

  it("overlaps consecutive chunks", () => {
    const chunks = chunkPages(
      [
        {
          page: 1,
          text: [
            "Introduction",
            "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu.",
            "Nu xi omicron pi rho sigma tau upsilon phi chi psi omega.",
            "Second block one two three four five six seven eight nine ten.",
            "Third block aa bb cc dd ee ff gg hh ii jj kk ll mm nn oo pp.",
          ].join("\n\n"),
        },
      ],
      { targetTokens: 60, overlapTokens: 25 }
    );
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const tail = chunks[0]!.content.slice(-40);
    expect(chunks[1]!.content).toContain(tail.slice(0, 20));
  });
});
