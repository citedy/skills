# Citedy Skills

Curated collection of AI agent skills by [Citedy](https://www.citedy.com) — works with [Claude Code](https://claude.com/claude-code), [Codex](https://openai.com/codex), [Gemini CLI](https://github.com/google-gemini/gemini-cli), [Droid](https://droid.dev), and any AI coding agent that reads `.md` skill files.

> **This package is actively maintained.** We regularly add new skills and improve existing ones.
> Run `npx @citedy/skills update` to get the latest version at any time.

## Install

```bash
npx @citedy/skills install
```

That's it. All skills and slash commands are copied into your project's `.claude/` directory, ready to use.

### Install specific skills only

```bash
npx @citedy/skills install youtube tiktok
```

### Stay up to date

```bash
npx @citedy/skills@latest update
```

New skills are added regularly. Use `@latest` to make sure you always get the newest version — no stale cache.

### See what's available

```bash
npx @citedy/skills list
```

## Available Skills

### Extraction Skills

| Name | Slash Command | Description | Requires |
|------|---------------|-------------|----------|
| `youtube` | `/any-youtube` | Extract structured metadata from any public YouTube video | AnyCrawl API |
| `instagram` | `/any-instagram` | Extract public Instagram profile, post, and reel data | AnyCrawl API |
| `tiktok` | `/any-tiktok` | Extract public TikTok video, profile, and hashtag data | AnyCrawl API |
| `social` | `/any-social` | Auto-detect platform and route to the correct extractor | AnyCrawl API |

### Knowledge Skills (no API keys needed)

| Name | Slash Command | Description |
|------|---------------|-------------|
| `schema` | `/schema-markup` | Add, fix, or optimize schema.org JSON-LD structured data |
| `icons` | `/icon-design` | Select semantically appropriate icons (Lucide/Heroicons/Phosphor) |
| `domains` | `/domain-hunter` | Search domains, compare prices, find promo codes |
| `skill-eval` | `/skill-eval` | Validate slash command quality (frontmatter, jargon, descriptions) |
| `symphony` | `/codex-symphony` | Bootstrap local OpenAI Symphony + Linear orchestration for any repo |
| `token-usage` | `/token-usage` | Analyze Claude Code token consumption and estimated costs |
| `prompt-analyzer` | `/prompt-analyzer` | Analyze prompts for constraint complexity, audit risks, and generate optimized rewrites for Claude/GPT |
| `html-deck` | `/html-deck` | Create browser-native HTML presentation decks with Editorial and Clean Grid systems |
| `adclaw-host-ai-accounting` | `/adclaw-host-ai-accounting` | Review AdClaw Host AI quotas, hosted keys, limits, and redaction |
| `adclaw-host-ops` | `/adclaw-host-ops` | Inspect AdClaw Host runtimes, operator alerts, and guarded admin actions |

### Agent Team Skills (Claude Code only)

| Name | Slash Command | Description |
|------|---------------|-------------|
| `spawning-plan` | `/spawning-plan` | Design and spawn optimal agent teams |
| `code-review` | `/code-review-team` | Parallel multi-agent code review with 4 reviewers |

> Agent Team skills require Claude Code with Agent Teams support (TeamCreate, TaskCreate, SendMessage).

Extraction skills use the [AnyCrawl](https://anycrawl.dev) Scrape API for LLM-powered structured data extraction.

## Setup

### 1. Get an AnyCrawl API key

Sign up at [anycrawl.dev](https://anycrawl.dev) and get your API key.

### 2. Add to your environment

```bash
# .env.local (or .env)
ANYCRAWL_API_KEY_DEV=ac-your-key-here
```

### 3. Install

```bash
npx @citedy/skills install
```

## Usage

Once installed, Claude Code automatically picks up skills when you provide a social media URL. Or invoke directly:

```
/any-youtube https://www.youtube.com/watch?v=VIDEO_ID
/any-instagram https://www.instagram.com/username/
/any-tiktok https://www.tiktok.com/@user/video/VIDEO_ID
/any-social <any-supported-url>
```

## What gets extracted

Each skill returns a structured JSON artifact saved to `/tmp/` with:

- **`normalized`** — Platform-specific structured data (title, stats, channel/author, description, etc.)
- **`anycrawl`** — Raw AnyCrawl response with markdown content
- **`request`** — The exact API payload used

## Requirements

- Node.js 18+
- [AnyCrawl](https://anycrawl.dev) API key
- [Claude Code](https://claude.com/claude-code) or [Codex](https://openai.com/codex)

## Prompt Analyzer Skill

The `prompt-analyzer` skill applies findings from ["How LLMs Follow Instructions: Skillful Coordination, Not a Universal Mechanism"](https://arxiv.org/abs/2604.06015) (Rocchetti & Ferrara, 2026) to audit and optimize prompts.

**What it does:**
1. Decomposes prompts into constraint types (structural, lexical, semantic, stylistic)
2. Scores complexity: Constraint Density, Cross-Type Mixing Index, Order Risk
3. Audits for conflicts, ambiguity, implicit constraints, and model-specific risks
4. Generates optimized rewrites — separate variants for Claude and GPT

**Usage:**
```
/prompt-analyzer path/to/prompts.md
```

The file can contain multiple prompts separated by `---`. Works with plain text, system prompts, and structured files (JSON/YAML).

Install just this skill:
```bash
npx @citedy/skills install prompt-analyzer
```

## Symphony Skill

The `symphony` skill is different from the extraction skills. It bootstraps local OpenAI Symphony orchestration into the current repository and installs:

- `WORKFLOW.symphony.md`
- `scripts/symphony/*`
- `.env.symphony.example`
- `codex-symphony` wrapper in `~/.local/bin`

Install just that skill:

```bash
npx @citedy/skills install symphony
```

Then in your target repo:

```bash
/codex-symphony
```

You will still need your own:

- `LINEAR_API_KEY`
- `LINEAR_PROJECT_SLUG`
- `SOURCE_REPO_URL`
- `SYMPHONY_WORKSPACE_ROOT`
- optional `GH_TOKEN`

## License

MIT — [Citedy](https://www.citedy.com)
