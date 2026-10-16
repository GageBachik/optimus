#!/usr/bin/env node
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);

// src/cli/index.ts
import os3 from "node:os";

// src/cli/doctor.ts
import { existsSync as existsSync2, readFileSync as readFileSync3, readdirSync as readdirSync2, statSync as statSync2, writeFileSync as writeFileSync2, unlinkSync } from "node:fs";
import { createRequire as requireFrom } from "node:module";
import { spawnSync } from "node:child_process";
import path3 from "node:path";

// src/lib/paths.ts
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
function ensure(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
  return p;
}
var safe = (s) => s.replace(/[^A-Za-z0-9_-]/g, "_");
var paths = {
  stateDir() {
    return ensure(path.normalize(process.env.PROJECT_MEMORY_HOME ?? path.join(os.homedir(), ".project-memory")));
  },
  blobsDir() {
    return ensure(path.join(this.stateDir(), "blobs"));
  },
  sessionDir(sessionId, agentId = "main") {
    return ensure(path.join(this.stateDir(), "sessions", safe(sessionId), safe(agentId)));
  },
  logsDir() {
    return ensure(path.join(this.stateDir(), "logs"));
  },
  configPath() {
    return path.join(this.stateDir(), "config.json");
  },
  config() {
    try {
      return JSON.parse(readFileSync(this.configPath(), "utf8"));
    } catch {
      return {};
    }
  },
  saveConfig(patch) {
    const next = { ...this.config(), ...patch };
    const tmp = this.configPath() + ".tmp";
    writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n");
    renameSync(tmp, this.configPath());
  },
  bankDir() {
    return path.normalize(process.env.PROJECT_MEMORY_BANK ?? this.config().bankDir ?? path.join(os.homedir(), "knowledge-bank"));
  },
  projectKey(cwd) {
    let dir = path.resolve(cwd);
    for (let i = 0; i < 8; i++) {
      const f = path.join(dir, ".kb.json");
      if (existsSync(f)) {
        try {
          const id = JSON.parse(readFileSync(f, "utf8")).project_id;
          if (typeof id === "string" && id) return safe(id);
        } catch {
        }
      }
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
    return createHash("sha256").update(path.normalize(cwd)).digest("hex").slice(0, 16);
  },
  projectDir(key) {
    return ensure(path.join(this.stateDir(), "projects", safe(key)));
  }
};

// src/cli/baseline.ts
import { readdirSync, readFileSync as readFileSync2, statSync } from "node:fs";
import path2 from "node:path";
function computeBaseline(projectsDir) {
  const files = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = path2.join(d, f);
      if (statSync(p).isDirectory()) {
        if (f !== "subagents") walk(p);
      } else if (f.endsWith(".jsonl")) files.push(p);
    }
  };
  walk(projectsDir);
  const ctx = [];
  let compactions = 0, cacheRead = 0, total = 0;
  for (const f of files) {
    let boundaries = 0, summaries = 0;
    for (const line of readFileSync2(f, "utf8").split("\n")) {
      if (!line) continue;
      let j;
      try {
        j = JSON.parse(line);
      } catch {
        continue;
      }
      if (j.type === "assistant" && j.message?.usage) {
        const u = j.message.usage;
        const c = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
        if (c > 0) {
          ctx.push(c);
          cacheRead += u.cache_read_input_tokens ?? 0;
          total += c;
        }
      }
      if (j.subtype === "compact_boundary") boundaries++;
      if (j.isCompactSummary) summaries++;
    }
    compactions += Math.max(boundaries, summaries);
  }
  ctx.sort((a, b) => a - b);
  const pct = (p) => ctx.length ? ctx[Math.min(ctx.length - 1, Math.floor(ctx.length * p))] : 0;
  return { sessions: files.length, turns: ctx.length, p50: pct(0.5), p90: pct(0.9), p99: pct(0.99), max: ctx.at(-1) ?? 0, compactions, cacheReadShare: total ? cacheRead / total : 0 };
}

// src/cli/doctor.ts
var readJsonFile = (f) => {
  try {
    return JSON.parse(readFileSync3(f, "utf8"));
  } catch {
    return null;
  }
};
function fts5Probe() {
  const emit = process.emitWarning;
  process.emitWarning = ((w, ...rest) => {
    const type = typeof rest[0] === "string" ? rest[0] : rest[0]?.type;
    if (type === "ExperimentalWarning") return;
    return emit.call(process, w, ...rest);
  });
  try {
    const { DatabaseSync } = requireFrom(import.meta.url)("node:sqlite");
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE VIRTUAL TABLE t USING fts5(x)");
    db.close();
    return { status: "PASS", name: "sqlite-fts5", detail: "node:sqlite creates an FTS5 table" };
  } catch (e) {
    return { status: "FAIL", name: "sqlite-fts5", detail: `node:sqlite FTS5 probe failed: ${e?.message ?? e}` };
  } finally {
    process.emitWarning = emit;
  }
}
function installedPlugins(home2) {
  const j = readJsonFile(path3.join(home2, ".claude", "plugins", "installed_plugins.json"));
  return Object.entries(j?.plugins ?? {}).flatMap(([name, entries]) => (Array.isArray(entries) ? entries : []).filter((e) => typeof e?.installPath === "string").map((e) => ({ name, installPath: e.installPath })));
}
var matchesAgent = (matcher) => {
  if (matcher === void 0 || matcher === "" || matcher === "*") return true;
  try {
    return new RegExp(`^(?:${matcher})$`).test("Agent");
  } catch {
    return matcher === "Agent";
  }
};
function doctorChecks(home2) {
  const out = [];
  out.push({ status: "INFO", name: "node", detail: `${process.version} (>= 24.15 recommended)` });
  out.push(fts5Probe());
  const git = spawnSync("git", ["--version"], { encoding: "utf8" });
  out.push(git.status === 0 ? { status: "PASS", name: "git", detail: git.stdout.trim() } : { status: "FAIL", name: "git", detail: "git not found on PATH" });
  const state = paths.stateDir();
  try {
    const probe = path3.join(state, `.doctor-${process.pid}`);
    writeFileSync2(probe, "ok");
    unlinkSync(probe);
    out.push({ status: "PASS", name: "state-dir", detail: `${state} writable` });
  } catch (e) {
    out.push({ status: "FAIL", name: "state-dir", detail: `${state} not writable: ${e?.message ?? e}` });
  }
  const blobs = readdirSync2(paths.blobsDir()).filter((f) => f.length === 64).map((f) => statSync2(path3.join(paths.blobsDir(), f)));
  const bytes = blobs.reduce((n, s) => n + s.size, 0);
  const oldest = blobs.length ? new Date(Math.min(...blobs.map((s) => s.mtimeMs))).toISOString() : "none";
  out.push({ status: "INFO", name: "blobs", detail: `${blobs.length} blobs, ${(bytes / 1048576).toFixed(1)} MB, oldest ${oldest}` });
  const sessionsDir = path3.join(state, "sessions");
  out.push({ status: "INFO", name: "sessions", detail: `${existsSync2(sessionsDir) ? readdirSync2(sessionsDir).length : 0} session dirs` });
  const settings = readJsonFile(path3.join(home2, ".claude", "settings.json")) ?? {};
  out.push(settings.autoCompactWindow === 2e5 ? { status: "PASS", name: "autoCompactWindow", detail: "200000" } : { status: "WARN", name: "autoCompactWindow", detail: `${settings.autoCompactWindow ?? "unset"} (run \`kb setup\` to set 200000)` });
  const enabled = settings.enabledPlugins ?? {};
  const installed = installedPlugins(home2);
  const ours = installed.filter((p) => p.name.startsWith("project-memory@"));
  const live = ours.find((p) => enabled[p.name] && existsSync2(path3.join(p.installPath, "hooks", "hooks.json")) && existsSync2(path3.join(p.installPath, "dist", "hook.js")));
  out.push(live ? { status: "PASS", name: "hooks", detail: `${live.name} hooks present in ${live.installPath}` } : { status: "WARN", name: "hooks", detail: ours.length ? `${ours[0].name} installed but not enabled or its cache lacks hooks/hooks.json + dist/hook.js` : "project-memory plugin not installed in the plugin cache" });
  const collisions = [];
  for (const p of installed) {
    if (!enabled[p.name] || p.name.startsWith("project-memory@")) continue;
    const hooks = readJsonFile(path3.join(p.installPath, "hooks", "hooks.json"))?.hooks ?? {};
    if ((hooks.PreToolUse ?? []).some((e) => matchesAgent(e?.matcher))) collisions.push(`${p.name}: PreToolUse matcher covers Agent`);
    if ((hooks.SubagentStart ?? []).length) collisions.push(`${p.name}: SubagentStart hook`);
  }
  if (collisions.length) for (const c of collisions) out.push({ status: "WARN", name: "collision", detail: c });
  else out.push({ status: "PASS", name: "collision", detail: "no other enabled plugin hooks PreToolUse Agent or SubagentStart" });
  return out;
}
function doctor(home2, opts = {}) {
  const checks = doctorChecks(home2);
  for (const c of checks) process.stdout.write(`${c.status.padEnd(4)}  ${c.name.padEnd(18)} ${c.detail}
`);
  if (opts.baseline) {
    const dir = path3.join(home2, ".claude", "projects");
    if (!existsSync2(dir)) process.stdout.write(`
baseline: ${dir} not found
`);
    else {
      const b = computeBaseline(dir);
      const k = (n) => `${Math.round(n / 1e3)}K`;
      process.stdout.write(`
baseline (${dir})
  sessions        ${b.sessions}
  turns           ${b.turns}
  context p50     ${k(b.p50)}
  context p90     ${k(b.p90)}
  context p99     ${k(b.p99)}
  context max     ${k(b.max)}
  compactions     ${b.compactions}
  cache-read share ${(b.cacheReadShare * 100).toFixed(1)}%
`);
    }
  }
  return checks.some((c) => c.status === "FAIL") ? 1 : 0;
}

// src/cli/cleanup.ts
import { existsSync as existsSync5, readFileSync as readFileSync5, readdirSync as readdirSync3, statSync as statSync4, rmSync, mkdirSync as mkdirSync2, cpSync } from "node:fs";
import path5 from "node:path";

// src/cli/backup.ts
import { copyFileSync, existsSync as existsSync4 } from "node:fs";

// src/lib/atomic.ts
import { writeFileSync as writeFileSync3, readFileSync as readFileSync4, renameSync as renameSync2, realpathSync, existsSync as existsSync3, statSync as statSync3, chmodSync, unlinkSync as unlinkSync2 } from "node:fs";
import path4 from "node:path";
import { randomBytes } from "node:crypto";
function writeFileAtomic(filePath, data) {
  const dir = realpathSync(path4.dirname(filePath));
  const target = path4.join(dir, path4.basename(filePath));
  const tmp = path4.join(dir, `.${path4.basename(filePath)}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`);
  const mode = existsSync3(target) ? statSync3(target).mode & 511 : void 0;
  writeFileSync3(tmp, data, "utf8");
  if (mode !== void 0) chmodSync(tmp, mode);
  let lastErr;
  for (let i = 0; i < 5; i++) {
    try {
      renameSync2(tmp, target);
      return;
    } catch (e) {
      lastErr = e;
      if (!["EPERM", "EBUSY", "ENOENT"].includes(e?.code)) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  try {
    unlinkSync2(tmp);
  } catch {
  }
  throw lastErr;
}

// src/cli/backup.ts
function backupFile(file) {
  if (existsSync4(file)) copyFileSync(file, `${file}.bak-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}`);
}
function backupAndWriteJson(file, value2) {
  backupFile(file);
  writeFileAtomic(file, JSON.stringify(value2, null, 2) + "\n");
}

// src/cli/cleanup.ts
var readJsonFile2 = (f) => existsSync5(f) ? JSON.parse(readFileSync5(f, "utf8")) : {};
function onPath(cmd2) {
  if (cmd2.includes("/") || cmd2.includes("\\")) return existsSync5(cmd2);
  const exts = process.platform === "win32" ? ["", ...(process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")] : [""];
  return (process.env.PATH ?? "").split(path5.delimiter).some((dir) => dir && exts.some((e) => existsSync5(path5.join(dir, cmd2 + e))));
}
function deadPath(arg) {
  if (typeof arg !== "string" || !path5.isAbsolute(arg) || arg.length < 2) return false;
  if (!existsSync5(arg)) return true;
  try {
    return statSync4(arg).isDirectory() && readdirSync3(arg).length === 0;
  } catch {
    return true;
  }
}
var flag = (id, target, reason) => ({ id, kind: "flag", target, reason, apply: () => {
} });
function planCleanup(home2) {
  const actions = [];
  const settingsPath = path5.join(home2, ".claude", "settings.json");
  const claudeJson = path5.join(home2, ".claude.json");
  const settings = readJsonFile2(settingsPath);
  const cj = readJsonFile2(claudeJson);
  const plugins = settings.enabledPlugins ?? {};
  const disable = (name, reason) => actions.push({ id: `plugin:${name}`, kind: "disable-plugin", target: name, reason, apply: () => {
    settings.enabledPlugins = { ...settings.enabledPlugins ?? {}, [name]: false };
    backupAndWriteJson(settingsPath, settings);
  } });
  if (plugins["agentmemory@agentmemory"]) disable("agentmemory@agentmemory", "12 hooks post to a dead localhost:3111 on every prompt");
  if ("claude-supermemory@supermemory-plugins" in plugins) disable("claude-supermemory@supermemory-plugins", plugins["claude-supermemory@supermemory-plugins"] ? "unused hosted memory plugin" : "unused hosted memory plugin (already disabled)");
  if (plugins["context-mode@context-mode"]) actions.push(flag("plugin:context-mode", "context-mode@context-mode", "retire after offload passes acceptance (its PreToolUse Agent rewrite collides with subagent briefs)"));
  for (const [name, def] of Object.entries(cj.mcpServers ?? {})) {
    if (name === "agentmemory") {
      actions.push({ id: `mcp:${name}`, kind: "remove-mcp", target: name, reason: "backend not running; replaced by project-memory", apply: () => {
        delete cj.mcpServers[name];
        backupAndWriteJson(claudeJson, cj);
      } });
      continue;
    }
    if (name === "serena") {
      actions.push(flag("mcp:serena", "serena", "remove after `kb import serena` has run"));
      continue;
    }
    const badArg = (Array.isArray(def?.args) ? def.args : []).find(deadPath);
    if (badArg) actions.push(flag(`mcp:${name}`, name, `argument path does not exist or is empty: ${badArg}`));
    else if (typeof def?.command === "string" && def.command && !onPath(def.command)) actions.push(flag(`mcp:${name}`, name, `command not on PATH: ${def.command}`));
  }
  const am = path5.join(home2, ".agentmemory");
  if (existsSync5(am)) actions.push({ id: "dir:.agentmemory", kind: "remove-dir", target: am, reason: "agentmemory state; its backups/ are copied to ~/.project-memory/imports/agentmemory first", apply: () => {
    const src = path5.join(am, "backups");
    const dest = path5.join(home2, ".project-memory", "imports", "agentmemory", "backups");
    if (existsSync5(src)) {
      mkdirSync2(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
    }
    rmSync(am, { recursive: true, force: true });
  } });
  return actions;
}

// src/cli/setup.ts
import os2 from "node:os";
import path6 from "node:path";
import { existsSync as existsSync6, readFileSync as readFileSync6, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
var defaultDeviceId = (host = os2.hostname()) => host.split(".")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-");
var HEADING = "## Compaction instructions (project-memory)";
function compactionInstructionsPath() {
  const here = path6.dirname(fileURLToPath(import.meta.url));
  return [path6.join(here, "..", "skills", "kb", "compaction-instructions.md"), path6.join(here, "..", "..", "skills", "kb", "compaction-instructions.md")].find(existsSync6) ?? path6.join(here, "..", "skills", "kb", "compaction-instructions.md");
}
function setup(home2, opts = {}) {
  const print = opts.print ?? ((l) => process.stdout.write(l + "\n"));
  const settingsPath = path6.join(home2, ".claude", "settings.json");
  const settings = existsSync6(settingsPath) ? JSON.parse(readFileSync6(settingsPath, "utf8")) : {};
  if (settings.autoCompactWindow === 2e5) print(`autoCompactWindow already 200000 in ${settingsPath}`);
  else {
    settings.autoCompactWindow = 2e5;
    backupAndWriteJson(settingsPath, settings);
    print(`set autoCompactWindow: 200000 in ${settingsPath} (backup written)`);
  }
  const deviceId = defaultDeviceId(opts.device ?? os2.hostname());
  paths.saveConfig({ deviceId });
  print(`deviceId: ${deviceId} (${paths.configPath()})`);
  const instructions = compactionInstructionsPath();
  const claudeMd = path6.join(home2, ".claude", "CLAUDE.md");
  if (!opts.appendClaudeMd) {
    print(`compaction instructions: ${instructions}`);
    print("  run `kb setup --append-claude-md` to append them to ~/.claude/CLAUDE.md");
    return;
  }
  if (existsSync6(claudeMd) && readFileSync6(claudeMd, "utf8").includes(HEADING)) {
    print(`${claudeMd} already carries the compaction instructions`);
    return;
  }
  backupFile(claudeMd);
  appendFileSync(claudeMd, `
${HEADING}

${readFileSync6(instructions, "utf8")}`);
  print(`appended compaction instructions to ${claudeMd} (backup written)`);
}

// src/cli/index.ts
var [cmd, ...args] = process.argv.slice(2);
var has = (f) => args.includes(f);
var value = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : void 0;
};
var home = os3.homedir();
var usage = "usage: kb doctor [--baseline] | kb cleanup [--apply] | kb setup [--device <name>] [--append-claude-md]\n";
if (cmd === "doctor") process.exitCode = doctor(home, { baseline: has("--baseline") });
else if (cmd === "cleanup") {
  const actions = planCleanup(home);
  const apply = has("--apply");
  if (!actions.length) process.stdout.write("nothing to clean up\n");
  for (const a of actions) {
    const label = a.kind === "flag" ? "FLAG" : apply ? "DONE" : "PLAN";
    if (apply && a.kind !== "flag") a.apply();
    process.stdout.write(`${label}  ${a.kind.padEnd(14)} ${a.target}  \u2014 ${a.reason}
`);
    if (a.kind === "disable-plugin") process.stdout.write(`      to uninstall as well: claude plugin uninstall ${a.target}
`);
  }
  if (!apply && actions.some((a) => a.kind !== "flag")) process.stdout.write("\nre-run with --apply to perform the PLAN lines (each edited file is backed up as <file>.bak-<timestamp>)\n");
} else if (cmd === "setup") {
  const device = value("--device");
  if (has("--device") && !device) {
    process.stderr.write("--device needs a name\n");
    process.exitCode = 2;
  } else setup(home, { device, appendClaudeMd: has("--append-claude-md") });
} else {
  process.stdout.write(usage);
  if (cmd && cmd !== "help" && cmd !== "--help") process.exitCode = 2;
}
