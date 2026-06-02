---
description: Create a browser-native HTML presentation deck
---
Treat `$1` as the presentation brief, topic, or source file path.
If `$1` is missing, ask the user for the deck topic, audience, target slide count, and preferred visual system (Product Grid v2 by default).

Find `<skill-dir>` before starting. **`@citedy/skills` only** — AdClaw uses `~/.adclaw/active_skills/html-presentation-deck` instead (see SKILL.md).

- `.codex/skills/html-presentation-deck` when this command lives under `.codex/commands/`.
- `.claude/skills/html-presentation-deck` when this command lives under `.claude/commands/`.
- If both exist, prefer the namespace that matches the invocation; otherwise use the one that exists.

Read `<skill-dir>/SKILL.md` and follow the workflow.

Create a standalone HTML deck at `deck/index.html`, then validate:

```bash
python3 <skill-dir>/scripts/validate_html_deck.py deck/index.html
python3 <skill-dir>/scripts/validate_deck_quality.py deck/index.html
```

Run `validate_deck_quality.py` only for Product Grid v2 decks (`data-system="product-grid"`).
