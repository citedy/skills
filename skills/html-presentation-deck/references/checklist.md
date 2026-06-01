# Quality Checklist

Run this before handing off an HTML presentation deck.

## Content

- One idea per slide.
- Title and metadata placeholders are replaced.
- Every image has useful `alt` text.
- Data claims include source context in speaker notes or nearby captions.
- No visible draft notes, private instructions, or placeholder copy.

## Design

- One visual system is used throughout.
- One theme is used throughout.
- Typography changes use `--display-font`, `--text-font`, and `--label-font` tokens instead of class-by-class overrides.
- External fonts are used only when the user explicitly approved hosted or self-hosted font dependencies.
- Bright accent colors are not used as small text on light panels.
- Dense slides are separated by simple statement or image slides.
- Screenshots are framed consistently.
- Mobile layout remains readable.

## Technical

- From the repo root, `python .claude/skills/html-presentation-deck/scripts/validate_html_deck.py deck/index.html` passes.
- Browser opens the file with no console-breaking script error.
- Arrow keys, touch swipe, and Escape index work.
- Local images load from `images/`.
- No external network dependency is required for the presentation to render.

## Language and Provenance

- The deck is English-only unless the user explicitly requests another language.
- When the deck is English-only, no non-English text, non-English comments, non-English font names, or non-English placeholders appear.
- No upstream project name, author name, or repository name appears in generated output.
