import { describe, it, expect } from "vitest";
import { buildContext } from "./prompt";
import type { RetrievedChunk } from "./retrieval";

const sampleChunks: RetrievedChunk[] = [
  {
    id: "a",
    paper_id: "p1",
    idx: 0,
    content: "Self-attention computes dependencies between all positions.",
    page: 3,
    section: "methods",
    similarity: 0.9,
    paper_title: "Attention Is All You Need",
  },
  {
    id: "b",
    paper_id: "p1",
    idx: 1,
    content: "The model achieved 28.4 BLEU on English-German translation.",
    page: 8,
    section: null,
    similarity: 0.8,
    paper_title: "Attention Is All You Need",
  },
];

describe("buildContext", () => {
  it("returns empty-library message when no chunks", () => {
    expect(buildContext([])).toMatch(/No relevant excerpts/);
  });

  it("wraps chunks in numbered excerpt XML", () => {
    const xml = buildContext(sampleChunks);
    expect(xml).toMatch(/^<excerpts>/);
    expect(xml).toMatch(/<\/excerpts>$/);
    expect(xml).toContain('id="1"');
    expect(xml).toContain('id="2"');
    expect(xml).toContain('paper="Attention Is All You Need"');
    expect(xml).toContain('location="section: methods, page 3"');
    expect(xml).toContain("Self-attention computes");
    expect(xml).toContain("28.4 BLEU");
  });
});
