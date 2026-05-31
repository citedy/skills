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
      fs.existsSync(path.join(dir, ".claude")) ||
      fs.existsSync(path.join(dir, ".codex"))
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
  npx @citedy/skills install [--target claude|codex|all] [names...]
                                           Install skills (default: all skills, all targets)
  npx @citedy/skills list                 List available skills
  npx @citedy/skills update [--target claude|codex|all] [names...]
                                           Re-install skills (overwrite)

Examples:
  npx @citedy/skills install              Install all skills + commands
  npx @citedy/skills install youtube      Install YouTube extractor only
  npx @citedy/skills install youtube tiktok
  npx @citedy/skills update --target codex html-deck

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

function parseOptions(args) {
  const names = [];
  let target = "all";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--target") {
      target = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--target=")) {
      target = arg.slice("--target=".length);
      continue;
    }
    names.push(arg);
  }

  if (!["claude", "codex", "all"].includes(target)) {
    console.error(`  Invalid target: "${target}". Use claude, codex, or all.`);
    process.exit(1);
  }

  return { names: names.length > 0 ? names : Object.keys(CATALOG), target };
}

function getDestinations(root, target) {
  const targets = target === "all" ? ["claude", "codex"] : [target];
  return targets.map((name) => {
    const namespace = name === "claude" ? ".claude" : ".codex";
    return {
      name,
      skillsDest: path.join(root, namespace, "skills"),
      commandsDest: path.join(root, namespace, "commands"),
    };
  });
}

function installSkills(names, overwrite = false, target = "all") {
  const root = findProjectRoot();
  const destinations = getDestinations(root, target);
  const anycrawlSkills = new Set(["youtube", "instagram", "tiktok", "social"]);
  const includesAnycrawl = names.some((name) => anycrawlSkills.has(name));
  const includesSymphony = names.includes("symphony");

  for (const destination of destinations) {
    fs.mkdirSync(destination.skillsDest, { recursive: true });
    fs.mkdirSync(destination.commandsDest, { recursive: true });
  }

  let installed = 0;

  for (const name of names) {
    const entry = CATALOG[name];
    if (!entry) {
      console.error(`  Unknown skill: "${name}". Available: ${Object.keys(CATALOG).join(", ")}`);
      continue;
    }

    const skillExistsEverywhere = destinations.every((destination) =>
      fs.existsSync(path.join(destination.skillsDest, entry.skill))
    );
    if (skillExistsEverywhere && !overwrite) {
      console.log(`  skip  ${entry.skill} (already exists in ${target}, use 'update' to overwrite)`);
      continue;
    }

    for (const destination of destinations) {
      const skillDest = path.join(destination.skillsDest, entry.skill);
      if (!fs.existsSync(skillDest) || overwrite) {
        copyDirSync(path.join(SKILLS_SRC, entry.skill), skillDest);
        console.log(`  skill ${entry.skill} -> ${destination.name}`);
      }

      const cmdSrc = path.join(COMMANDS_SRC, entry.command);
      const cmdDest = path.join(destination.commandsDest, entry.command);
      if (fs.existsSync(cmdSrc)) {
        fs.copyFileSync(cmdSrc, cmdDest);
        console.log(`  cmd   /${entry.command.replace(".md", "")} -> ${destination.name}`);
      }
    }

    installed++;
  }

  if (installed > 0) {
    const targetList = destinations
      .map((destination) => path.relative(process.cwd(), destination.skillsDest))
      .join(", ");
    console.log(`\nInstalled ${installed} skill(s) to ${targetList}`);
    if (includesAnycrawl) {
      console.log("\nNext: add ANYCRAWL_API_KEY_DEV=... to your .env.local");
    }
    if (includesSymphony) {
      console.log("Next: run /codex-symphony inside your target repo and fill the required LINEAR_* env vars");
    }
    console.log("Docs: https://github.com/Citedy/skills");
  }
}

function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;

  switch (command) {
    case "install": {
      const { names, target } = parseOptions(args);
      console.log("\nInstalling Citedy skills...\n");
      installSkills(names, false, target);
      break;
    }
    case "update": {
      const { names, target } = parseOptions(args);
      console.log("\nUpdating Citedy skills...\n");
      installSkills(names, true, target);
      break;
    }
    case "list":
      listSkills();
      break;
    default:
      printUsage();
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = { installSkills, parseOptions, main };
