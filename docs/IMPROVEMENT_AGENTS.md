# Nosramus improvement agents

Two agents continuously evaluate and improve this project. Run them manually or via Cursor Automations on a schedule.

## Agents

| Agent | Role | Output |
|-------|------|--------|
| **Benchmark** | Compare features, UX, and positioning vs Elicit, Consensus, Linear, Perplexity, Zotero | `docs/agent-benchmark.md` |
| **Critic** | Harsh portfolio review; what hiring managers reject in 30s | `docs/agent-critic.md` |
| **Debate** | Synthesizes both into a unified roadmap | `docs/agent-debate.md` |

## How to run

In Cursor Agent chat:

```
Read .cursor/agents/benchmark.md and execute the full workflow. Update docs/agent-benchmark.md.
```

```
Read .cursor/agents/critic.md and execute. Update docs/agent-critic.md and docs/agent-debate.md.
```

Then implement top items from `docs/agent-debate.md`.

## Principles

- **Originality over cloning** — borrow UX patterns, not feature checklists
- **Employer signal** — auth, RLS, vector search, streaming, citations must be obvious
- **Ship visible diffs** — landing, empty states, and one unique feature beat internal refactors

## Improvement log

Track shipped changes in `docs/IMPROVEMENT_LOG.md`.
