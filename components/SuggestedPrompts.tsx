"use client";

const PROMPTS = [
  "Summarize the main contribution in two sentences.",
  "What method did the authors use, and where is it weak?",
  "What numbers or benchmarks do they report?",
  "Define the key term the paper relies on.",
  "What do they leave unresolved for future work?",
];

export default function SuggestedPrompts({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="mt-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        Starter questions
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt)}
            className="shrink-0 rounded-full border border-edge bg-elevated/40 px-4 py-2 text-left text-sm text-muted transition-colors hover:border-edge-hover hover:text-foreground"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
