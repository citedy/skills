#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const SKILLS_SRC = path.join(PACKAGE_ROOT, "skills");
const COMMANDS_SRC = path.join(PACKAGE_ROOT, "commands");

const CATALOG = {
  youtube: {
    skill: "anycrawl-youtube-video-extractor",
    command: "any-youtube.md",
    description: "Extract YouTube video metadata",
  },
  instagram: {
    skill: "anycrawl-instagram-scraper",
    command: "any-instagram.md",
    description: "Extract Instagram profile/post/reel data",
  },
  tiktok: {
    skill: "anycrawl-tiktok-scraper",
    command: "any-tiktok.md",
    description: "Extract TikTok video/profile data",
  },
  social: {
    skill: "anycrawl-social-extractor",
    command: "any-social.md",
    description: "Auto-detect platform and route to correct extractor",
  },
  schema: {
    skill: "schema-markup",
    command: "schema-markup.md",
    description: "Add, fix, or optimize schema markup (JSON-LD)",
  },
  icons: {
    skill: "icon-design",
    command: "icon-design.md",
    description: "Select semantically appropriate icons (Lucide/Heroicons/Phosphor)",
  },
  "spawning-plan": {
    skill: "spawning-plan",
    command: "spawning-plan.md",
    description: "Design and spawn optimal agent teams (Claude Code)",
  },
  "code-review": {
    skill: "code-review-agent-team",
    command: "code-review-team.md",
    description: "Parallel multi-agent code review (Claude Code)",
  },
  domains: {
    skill: "domain-hunter",
    command: "domain-hunter.md",
    description: "Search domains, compare prices, find promo codes",
  },
  "skill-eval": {
    skill: "skill-quality-eval",
    command: "skill-eval.md",
    description: "Validate slash command quality (frontmatter, descriptions, jargon)",
  },
  symphony: {
    skill: "codex-symphony",
    command: "codex-symphony.md",
    description: "Bootstrap local OpenAI Symphony + Linear orchestration",
  },
  "token-usage": {
    skill: "token-usage",
    command: "token-usage.md",
    description: "Analyze Claude Code token usage and estimated costs",
  },
  "adclaw-host-ai-accounting": {
    skill: "adclaw-host-ai-accounting",
    command: "adclaw-host-ai-accounting.md",
    description: "Review AdClaw Host AI quotas, hosted keys, limits, and redaction",
  },
  "adclaw-host-ops": {
    skill: "adclaw-host-ops",
    command: "adclaw-host-ops.md",
    description: "Inspect AdClaw Host operators, runtimes, alerts, and safe admin actions",
  },
  "html-deck": {
    skill: "html-presentation-deck",
    command: "html-deck.md",
    description: "Create browser-native HTML presentation decks",
  },
};

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function findProjectRoot() {
  let dir = process.cwd();
  while (true) {
    if (
      fs.existsSync(path.join(dir, "package.json")) ||
      fs.existsSync(path.join(dir, ".git")) ||
      fs.existsSync(path.join(dir, ".claude"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

function printUsage() {
  console.log(`
@citedy/skills — Claude Code skill installer

Usage:
  npx @citedy/skills install [names...]   Install skills (default: all)
  npx @citedy/skills list                 List available skills
  npx @citedy/skills update               Re-install all (overwrite)

Examples:
  npx @citedy/skills install              Install all skills + commands
  npx @citedy/skills install youtube      Install YouTube extractor only
  npx @citedy/skills install youtube tiktok

Available skills: ${Object.keys(CATALOG).join(", ")}
`);
}

function listSkills() {
  console.log("\nAvailable skills:\n");
  for (const [name, info] of Object.entries(CATALOG)) {
    console.log(`  ${name.padEnd(12)} ${info.description}`);
    console.log(`  ${"".padEnd(12)} skill: ${info.skill}`);
    console.log(`  ${"".padEnd(12)} command: /${info.command.replace(".md", "")}`);
    console.log();
  }
}

function installSkills(names, overwrite = false) {
  const root = findProjectRoot();
  const skillsDest = path.join(root, ".claude", "skills");
  const commandsDest = path.join(root, ".claude", "commands");
  const anycrawlSkills = new Set(["youtube", "instagram", "tiktok", "social"]);
  const includesAnycrawl = names.some((name) => anycrawlSkills.has(name));
  const includesSymphony = names.includes("symphony");

  fs.mkdirSync(skillsDest, { recursive: true });
  fs.mkdirSync(commandsDest, { recursive: true });

  let installed = 0;

  for (const name of names) {
    const entry = CATALOG[name];
    if (!entry) {
      console.error(`  Unknown skill: "${name}". Available: ${Object.keys(CATALOG).join(", ")}`);
      continue;
    }

    const skillDest = path.join(skillsDest, entry.skill);
    if (fs.existsSync(skillDest) && !overwrite) {
      console.log(`  skip  ${entry.skill} (already exists, use 'update' to overwrite)`);
      continue;
    }

    copyDirSync(path.join(SKILLS_SRC, entry.skill), skillDest);
    console.log(`  skill ${entry.skill}`);

    const cmdSrc = path.join(COMMANDS_SRC, entry.command);
    const cmdDest = path.join(commandsDest, entry.command);
    if (fs.existsSync(cmdSrc)) {
      fs.copyFileSync(cmdSrc, cmdDest);
      console.log(`  cmd   /${entry.command.replace(".md", "")}`);
    }

    installed++;
  }

  if (installed > 0) {
    console.log(`\nInstalled ${installed} skill(s) to ${path.relative(process.cwd(), skillsDest)}`);
    if (includesAnycrawl) {
      console.log("\nNext: add ANYCRAWL_API_KEY_DEV=... to your .env.local");
    }
    if (includesSymphony) {
      console.log("Next: run /codex-symphony inside your target repo and fill the required LINEAR_* env vars");
    }
    console.log("Docs: https://github.com/Citedy/skills");
  }
}

const [, , command, ...args] = process.argv;

switch (command) {
  case "install": {
    const names = args.length > 0 ? args : Object.keys(CATALOG);
    console.log("\nInstalling Citedy skills...\n");
    installSkills(names);
    break;
  }
  case "update": {
    const names = args.length > 0 ? args : Object.keys(CATALOG);
    console.log("\nUpdating Citedy skills...\n");
    installSkills(names, true);
    break;
  }
  case "list":
    listSkills();
    break;
  default:
    printUsage();
    break;
}
