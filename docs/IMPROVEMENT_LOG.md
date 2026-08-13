# Improvement log

## 2026-08-11

### Fixed
- **Landing page black gap** — `.app-bg > * { position: relative }` was overriding `fixed` on decorative orbs, pushing content down ~500px. Replaced with `.app-bg-main` wrapper.

### Added
- **Improvement agents** — `.cursor/agents/benchmark.md` and `.cursor/agents/critic.md` for ongoing competitive analysis and harsh critique (`docs/IMPROVEMENT_AGENTS.md`)
- **Landing differentiators** — "Not another chatbot" section + tech stack pills for employer signal
- **Suggested prompts** — empty chat state with research-specific starter questions
- Background agent runs writing to `docs/agent-benchmark.md`, `docs/agent-critic.md`, `docs/agent-debate.md`

### Pending (from agents)
- Review agent reports when complete and implement top roadmap items
