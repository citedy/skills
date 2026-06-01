---
description: Create a browser-native HTML presentation deck
---
Treat `$1` as the presentation brief, topic, or source file path.
If `$1` is missing, ask the user for the deck topic, audience, target slide count, and preferred visual system.

Find the installed skill directory before starting:

- Use `.codex/skills/html-presentation-deck` when this command is installed under `.codex/commands/`.
- Use `.claude/skills/html-presentation-deck` when this command is installed under `.claude/commands/`.
- If both exist, prefer the directory that matches the command namespace; otherwise use the one that exists.

Read `<installed-skill-dir>/SKILL.md` and follow the workflow.

Create a standalone HTML deck at `deck/index.html`, then validate it with `python3 <installed-skill-dir>/scripts/validate_html_deck.py deck/index.html`.
