import { describe, it, expect } from "vitest";
import { reciprocalRankFusion } from "./retrieval";

describe("reciprocalRankFusion", () => {
  it("boosts items appearing in both ranked lists", () => {
    const vectorRows = [
      {
        id: "shared",
        paper_id: "p1",
        idx: 0,
        content: "shared chunk",
        page: 1,
        section: null,
        similarity: 0.9,
      },
      {
        id: "vec-only",
        paper_id: "p1",
        idx: 1,
        content: "vector only",
        page: 2,
        section: null,
        similarity: 0.8,
      },
    ];

    const ftsRows = [
      {
        id: "shared",
        paper_id: "p1",
        idx: 0,
        content: "shared chunk",
        page: 1,
        section: null,
        rank: 0.7,
      },
      {
        id: "fts-only",
        paper_id: "p1",
        idx: 2,
        content: "fts only",
        page: 3,
        section: null,
        rank: 0.6,
      },
    ];

    const fused = reciprocalRankFusion(vectorRows, ftsRows, 10);
    expect(fused[0]!.row.id).toBe("shared");
    expect(fused[0]!.score).toBeGreaterThan(fused[1]!.score);
  });

  it("includes single-list items with partial score", () => {
    const vectorRows = [
      {
        id: "only-here",
        paper_id: "p1",
        idx: 0,
        content: "solo",
        page: 1,
        section: null,
        similarity: 0.5,
      },
    ];

    const fused = reciprocalRankFusion(vectorRows, [], 5);
    expect(fused).toHaveLength(1);
    expect(fused[0]!.row.id).toBe("only-here");
    expect(fused[0]!.score).toBeCloseTo(1 / (60 + 1), 5);
  });
});
