const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { installSkills, parseOptions } = require("../bin/cli.js");

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "citedy-skills-target-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "target-test" }));
  return root;
}

function runInstall(root, target) {
  const previousCwd = process.cwd();
  process.chdir(root);
  try {
    installSkills(["html-deck"], true, target);
  } finally {
    process.chdir(previousCwd);
  }
}

function assertInstalled(root, namespace, expected) {
  const skill = path.join(root, namespace, "skills", "html-presentation-deck", "SKILL.md");
  const command = path.join(root, namespace, "commands", "html-deck.md");
  assert.equal(fs.existsSync(skill), expected, `${namespace} skill expected ${expected}`);
  assert.equal(fs.existsSync(command), expected, `${namespace} command expected ${expected}`);
}

function assertHtmlDeckCommandSupportsRuntime(root, namespace) {
  const command = path.join(root, namespace, "commands", "html-deck.md");
  const content = fs.readFileSync(command, "utf8");
  assert.match(content, /\.codex\/skills\/html-presentation-deck/);
  assert.match(content, /\.claude\/skills\/html-presentation-deck/);
  assert.match(content, /python3 <skill-dir>\/scripts\/validate_html_deck\.py/);
  assert.match(content, /active_skills\/html-presentation-deck/);
  assert.doesNotMatch(content, /validate it with `\.claude\/skills\/html-presentation-deck/);
}

{
  const root = makeProject();
  runInstall(root, "codex");
  assertInstalled(root, ".codex", true);
  assertInstalled(root, ".claude", false);
  assertHtmlDeckCommandSupportsRuntime(root, ".codex");
}

{
  const root = makeProject();
  runInstall(root, "claude");
  assertInstalled(root, ".claude", true);
  assertInstalled(root, ".codex", false);
  assertHtmlDeckCommandSupportsRuntime(root, ".claude");
}

{
  const root = makeProject();
  runInstall(root, "all");
  assertInstalled(root, ".claude", true);
  assertInstalled(root, ".codex", true);
}

{
  assert.deepEqual(parseOptions(["--target", "codex", "html-deck"]), {
    names: ["html-deck"],
    target: "codex",
  });
  assert.deepEqual(parseOptions(["--target=claude", "html-deck"]), {
    names: ["html-deck"],
    target: "claude",
  });
  assert.equal(parseOptions(["html-deck"]).target, "all");
}

console.log("cli target tests passed");
