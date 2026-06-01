const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
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

function runValidator(script, html) {
  const root = makeProject();
  const deck = path.join(root, "deck.html");
  fs.writeFileSync(deck, html);
  return spawnSync("python3", [path.join(__dirname, "..", script), deck], {
    encoding: "utf8",
  });
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

{
  const result = runValidator(
    "skills/html-presentation-deck/scripts/validate_html_deck.py",
    `<!doctype html>
<html lang="en">
<head>
<style>:root { --paper: rgb(255,255,255); --muted: rgb(250,250,250); }</style>
</head>
<body><section class="slide"></section></body>
</html>`,
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /muted text on paper/);
}

{
  const result = runValidator(
    "skills/html-presentation-deck/scripts/validate_html_deck.py",
    `<!doctype html>
<html lang="en">
<head>
<style>
:root { --ink: #000000; --paper: #ffffff; --muted: #111111; --panel: #ffffff; }
.slide.theme-dark { --muted: rgba(255,255,255,.2); --panel: rgba(255,255,255,.08); }
.slide.theme-dark { --panel: rgba(255,255,255,.4); }
</style>
</head>
<body><section class="slide theme-dark"></section></body>
</html>`,
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /muted text on slide background/);
  assert.match(result.stderr, /muted text on panel/);
}

{
  const result = runValidator(
    "skills/html-presentation-deck/scripts/validate_html_deck.py",
    `<!doctype html>
<html lang="en">
<head>
<style>
@media (prefers-color-scheme: dark) { :root { --muted: #ffffff; --panel: #ffffff; } }
:root {
  --paper: #ffffff;
  --muted: #555555;
  --asset: url("image{1}.png");
  /* { ignored } */
  @media (min-width: 1px) { --muted: #ffffff; --panel: #ffffff; }
  --accent-text: #111111;
  --panel: #eeeeee;
}
</style>
</head>
<body><section class="slide" style="--panel: 'decorative'; --muted: #222222"></section></body>
</html>`,
  );
  assert.equal(result.status, 0);
}

{
  const result = runValidator(
    "skills/html-presentation-deck/scripts/validate_html_deck.py",
    `<!doctype html>
<html lang="en">
<head>
<style>
:root { --ink: #000000; --paper: #ffffff; --muted: #111111; --panel: #ffffff; }
.slide.theme-dark { --muted: rgba(255,255,255,.2); --panel: rgba(255,255,255,.08); }
</style>
</head>
<body><section class="slide theme-dark" style="--panel: rgba(255,255,255,.4)"></section></body>
</html>`,
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /muted text on slide background/);
  assert.match(result.stderr, /muted text on panel/);
}

{
  const result = runValidator(
    "skills/html-presentation-deck/scripts/validate_html_deck.py",
    `<!doctype html>
<html lang="en">
<head>
<style>:root { --paper: #ffffff; --muted: #555555; --panel: #eeeeee; }</style>
</head>
<body>
<pre>:root { --paper: #000000; --muted: #000000; }</pre>
<section class="slide"></section>
</body>
</html>`,
  );
  assert.equal(result.status, 0);
}

{
  const result = runValidator(
    "skills/html-presentation-deck/scripts/validate_html_deck.py",
    `<!doctype html>
<html lang="en">
<head>
<style>
:root {
  --paper: #ffffff;
  --muted-base: #777777;
  --muted: var(--muted-base);
  --panel-base: #eeeeee;
  --panel: var(--panel-base);
}
</style>
</head>
<body><section class="slide"></section></body>
</html>`,
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /muted text on paper/);
  assert.match(result.stderr, /muted text on panel/);
}

{
  const result = runValidator(
    "skills/html-presentation-deck/scripts/validate_html_deck.py",
    `<!doctype html>
<html lang="en">
<head>
<style>:root { --paper: #ffffff; --muted: rgba(0,0,0,20%); }</style>
</head>
<body><section class="slide"></section></body>
</html>`,
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /muted text on paper/);
}

{
  const result = runValidator(
    "skills/html-presentation-deck/scripts/validate_html_deck.py",
    `<!doctype html>
<html lang="en">
<head>
<style>:root { --paper: #ffffff; --muted: rgba(0,0,0,1.2.3); }</style>
</head>
<body><section class="slide"></section></body>
</html>`,
  );
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stderr, /Traceback/);
}

{
  const result = runValidator(
    "skills/html-presentation-deck/scripts/validate_deck_quality.py",
    `<!doctype html>
<html lang="en">
<head><style>.deck{display:flex}.slide{display:block}.stage{display:block}.progress{display:block}.nav{display:block}.index{display:block}</style></head>
<body>
<section class="slide" data-system="product-grid" data-layout="PG02">
  <div class="stage"><img src="" alt="Empty source" data-image-slot="pg02-media-16x10"></div>
</section>
</body>
</html>`,
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /image 1 has blank src/);
}

console.log("cli target tests passed");
