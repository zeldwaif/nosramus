import { describe, it, expect } from "vitest";
import { parseContradictions } from "./contradictions";

describe("parseContradictions", () => {
  it("strips contradictions block from content", () => {
    const input = `The papers disagree on the metric.[1]

<contradictions>[{"claim":"BLEU score","paper_a":"Paper A","quote_a":"28.4","paper_b":"Paper B","quote_b":"27.9"}]</contradictions>`;

    const { content, contradictions } = parseContradictions(input);
    expect(content).not.toContain("<contradictions>");
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0]!.claim).toBe("BLEU score");
  });

  it("returns empty array when block is missing", () => {
    const { content, contradictions } = parseContradictions("Plain answer.");
    expect(content).toBe("Plain answer.");
    expect(contradictions).toEqual([]);
  });
});
