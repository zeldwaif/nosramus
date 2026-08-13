/**
 * USD per million tokens. Update manually against console.anthropic.com pricing.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-haiku-4-20250414": { input: 0.8, output: 4 },
};

const DEFAULT = { input: 3, output: 15 };

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = PRICING[model] ?? DEFAULT;
  return (
    (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000
  );
}
