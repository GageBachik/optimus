#!/usr/bin/env node
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);

// src/cli/index.ts
import os3 from "node:os";

// src/cli/doctor.ts
import { existsSync as existsSync3, readFileSync as readFileSync4, readdirSync as readdirSync2, statSync as statSync2, writeFileSync as writeFileSync3, unlinkSync } from "node:fs";
import { createRequire as requireFrom } from "node:module";
import { spawnSync as spawnSync2 } from "node:child_process";
import path4 from "node:path";

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

// src/cli/live-test.ts
import { spawnSync } from "node:child_process";
import { existsSync as existsSync2, mkdirSync as mkdirSync2, mkdtempSync, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { tmpdir } from "node:os";
import path3 from "node:path";
import { fileURLToPath } from "node:url";

// src/lib/transcript.ts
import { openSync, readSync, fstatSync, closeSync } from "node:fs";
function readTranscript(path8, fromOffset = 0) {
  const fd = openSync(path8, "r");
  try {
    const size = fstatSync(fd).size;
    if (fromOffset >= size) return { entries: [], toOffset: size };
    const buf = Buffer.alloc(size - fromOffset);
    readSync(fd, buf, 0, buf.length, fromOffset);
    const lastNl = buf.lastIndexOf(10);
    const complete = lastNl >= 0 ? buf.subarray(0, lastNl + 1) : buf.subarray(0, 0);
    const entries = [];
    for (const line of complete.toString("utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line));
      } catch {
      }
    }
    return { entries, toOffset: fromOffset + complete.length };
  } finally {
    closeSync(fd);
  }
}
function blocks(e) {
  const c = e.message?.content;
  return Array.isArray(c) ? c : typeof c === "string" ? [{ type: "text", text: c }] : [];
}

// src/cli/live-test.ts
var START_MARKER = "START-MARKER-ALPHA-1111";
var END_MARKER = "END-MARKER-OMEGA-9999";
var PROBE_MJS = `import fs from 'node:fs';
const raw = fs.readFileSync(0, 'utf8'); let j = {}; try { j = JSON.parse(raw); } catch {}
const [mode, logFile] = process.argv.slice(2);
fs.appendFileSync(logFile, JSON.stringify({ t: new Date().toISOString(), ev: j.hook_event_name, source: j.source, transcript_path: j.transcript_path, tool_name: j.tool_name, tool_response: j.hook_event_name === 'PostToolUse' ? j.tool_response : undefined }) + '\\n');
if (mode === 'brief') process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '${START_MARKER} begins. ' + 'filler-text-line-to-pad-the-brief-past-the-cap. '.repeat(250) + ' ${END_MARKER}.' } }));
`;
var PROMPT = `Follow these steps exactly, in order. Do not read any file other than hello.txt and do not run any command other than the one given.
1. Run the Bash command: seq 1 5000
2. Read the file hello.txt with the Read tool.
3. Use the Agent tool once (subagent_type general-purpose) with this prompt: "Do not use any tools. Reply with the complete text of every note mentioning 'Project memory' or 'recall' that you can see in your context, verbatim. If there is none, reply NONE."
4. Reply with exactly these five lines and nothing else:
SAW_START=<yes if the text ${START_MARKER} appears anywhere in your context, else no>
SAW_END=<yes if the text ${END_MARKER} appears anywhere in your context, else no>
BASH_PLACEHOLDER=<yes if the seq output you received contains the words "lines offloaded", else no>
SUBAGENT=<the subagent's reply on one line>
DONE`;
function liveSettings(hookJs, probe, logFile) {
  const plugin = (event, timeout) => ({ type: "command", command: "node", args: ["--disable-warning=ExperimentalWarning", hookJs, event], timeout });
  const log = { type: "command", command: "node", args: [probe, "log", logFile], timeout: 10 };
  return { hooks: {
    SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "node", args: [probe, "brief", logFile], timeout: 10 }] }, { matcher: "compact|resume", hooks: [log] }],
    PostToolUse: [{ matcher: "Bash", hooks: [plugin("post-tool-use", 10)] }, { matcher: "Read", hooks: [log] }],
    SubagentStart: [{ hooks: [plugin("subagent-start", 5)] }],
    PreCompact: [{ hooks: [plugin("pre-compact", 30), log] }],
    PostCompact: [{ hooks: [plugin("post-compact", 15), log] }]
  } };
}
function userTexts(entries) {
  const end = entries.findIndex((e) => e.type === "system" && e.subtype === "compact_boundary");
  return (end >= 0 ? entries.slice(0, end) : entries).filter((e) => e.type === "user").flatMap(blocks).map((b) => b?.type === "text" ? String(b.text) : b?.type === "tool_result" ? typeof b.content === "string" ? b.content : (Array.isArray(b.content) ? b.content : []).filter((c) => c?.type === "text").map((c) => String(c.text)).join("\n") : "").filter(Boolean);
}
function evaluate(a) {
  const at = (ev, source) => a.events.findIndex((e) => e.ev === ev && (source === void 0 || e.source === source));
  const post = at("PostCompact"), restore = at("SessionStart", "compact");
  return {
    postToolUseReplaced: a.texts.some((t) => t.includes("lines offloaded \xB7 id")),
    subagentBriefSeen: a.texts.some((t) => t.includes("recall(id)")),
    capTruncates: /SAW_START=yes/i.test(a.result) && /SAW_END=no/i.test(a.result),
    auditWritten: a.auditExists,
    auditBeforeRestore: a.auditExists && post >= 0 && restore > post
  };
}
var parse = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};
function findHookJs() {
  for (let d = path3.dirname(fileURLToPath(import.meta.url)); ; d = path3.dirname(d)) {
    const f = path3.join(d, "dist", "hook.js");
    if (existsSync2(f)) return f;
    if (path3.dirname(d) === d) throw new Error("dist/hook.js not found; run npm run build");
  }
}
function runLiveTest(opts = {}) {
  const hookJs = opts.hookJs ?? findHookJs();
  const claude = opts.claude ?? "claude";
  const dir = mkdtempSync(path3.join(tmpdir(), "pm-live-"));
  const state = path3.join(dir, "state");
  const probe = path3.join(dir, "probe.mjs");
  const logFile = path3.join(dir, "events.jsonl");
  mkdirSync2(path3.join(dir, ".claude"));
  writeFileSync2(probe, PROBE_MJS);
  writeFileSync2(path3.join(dir, "hello.txt"), "hello from the project-memory live test\n");
  writeFileSync2(path3.join(dir, ".claude", "settings.json"), JSON.stringify(liveSettings(hookJs, probe, logFile), null, 2));
  const { CLAUDECODE: _nested, ...env } = process.env;
  const run = (args2) => spawnSync(
    claude,
    [...args2, "--permission-mode", "bypassPermissions", "--model", "claude-haiku-5-5", "--max-turns", "12", "--output-format", "json", "--setting-sources", "project"],
    { cwd: dir, env: { ...env, PROJECT_MEMORY_HOME: state }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 6e5, maxBuffer: 64 * 1024 * 1024 }
  );
  const started = Date.now();
  const lines = [`dir: ${dir}`];
  const r1 = run(["-p", PROMPT]);
  const j1 = parse(r1.stdout);
  lines.push(`run1: exit ${r1.status}${r1.stderr.trim() ? ` stderr: ${r1.stderr.trim()}` : ""}`, `run1 result: ${j1?.result ?? r1.stdout.slice(0, 1e3)}`);
  if (j1?.session_id) {
    const r2 = run(["-p", "/compact", "--resume", j1.session_id]);
    lines.push(`run2 (/compact): exit ${r2.status}${r2.stderr.trim() ? ` stderr: ${r2.stderr.trim()}` : ""}`, `run2 result: ${parse(r2.stdout)?.result ?? r2.stdout.slice(0, 1e3)}`);
  }
  const wallMs = Date.now() - started;
  const events = existsSync2(logFile) ? readFileSync3(logFile, "utf8").split("\n").map(parse).filter(Boolean) : [];
  const tp = events.find((e) => e.transcript_path)?.transcript_path;
  const texts = tp && existsSync2(tp) ? userTexts(readTranscript(tp).entries) : [];
  const auditExists = typeof j1?.session_id === "string" && existsSync2(path3.join(state, "sessions", j1.session_id, "main", "audit.json"));
  lines.push(`events: ${events.map((e) => `${e.ev}${e.source ? `(${e.source})` : ""}${e.tool_name ? `(${e.tool_name})` : ""}`).join(" \u2192 ") || "none logged"}`, `audit.json: ${auditExists ? "present" : "absent"}`);
  const hooksLog = path3.join(state, "logs", "hooks.log");
  if (existsSync2(hooksLog)) lines.push("hooks.log:", readFileSync3(hooksLog, "utf8").trim());
  return { ...evaluate({ result: String(j1?.result ?? ""), texts, events, auditExists }), wallMs, log: lines.join("\n") };
}

// src/cli/doctor.ts
var readJsonFile = (f) => {
  try {
    return JSON.parse(readFileSync4(f, "utf8"));
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
  const j = readJsonFile(path4.join(home2, ".claude", "plugins", "installed_plugins.json"));
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
  const git = spawnSync2("git", ["--version"], { encoding: "utf8" });
  out.push(git.status === 0 ? { status: "PASS", name: "git", detail: git.stdout.trim() } : { status: "FAIL", name: "git", detail: "git not found on PATH" });
  const state = paths.stateDir();
  try {
    const probe = path4.join(state, `.doctor-${process.pid}`);
    writeFileSync3(probe, "ok");
    unlinkSync(probe);
    out.push({ status: "PASS", name: "state-dir", detail: `${state} writable` });
  } catch (e) {
    out.push({ status: "FAIL", name: "state-dir", detail: `${state} not writable: ${e?.message ?? e}` });
  }
  const blobs = readdirSync2(paths.blobsDir()).filter((f) => f.length === 64).map((f) => statSync2(path4.join(paths.blobsDir(), f)));
  const bytes = blobs.reduce((n, s) => n + s.size, 0);
  const oldest = blobs.length ? new Date(Math.min(...blobs.map((s) => s.mtimeMs))).toISOString() : "none";
  out.push({ status: "INFO", name: "blobs", detail: `${blobs.length} blobs, ${(bytes / 1048576).toFixed(1)} MB, oldest ${oldest}` });
  const sessionsDir = path4.join(state, "sessions");
  out.push({ status: "INFO", name: "sessions", detail: `${existsSync3(sessionsDir) ? readdirSync2(sessionsDir).length : 0} session dirs` });
  const settings = readJsonFile(path4.join(home2, ".claude", "settings.json")) ?? {};
  out.push(settings.autoCompactWindow === 2e5 ? { status: "PASS", name: "autoCompactWindow", detail: "200000" } : { status: "WARN", name: "autoCompactWindow", detail: `${settings.autoCompactWindow ?? "unset"} (run \`kb setup\` to set 200000)` });
  const enabled = settings.enabledPlugins ?? {};
  const installed = installedPlugins(home2);
  const ours = installed.filter((p) => p.name.startsWith("project-memory@"));
  const live = ours.find((p) => enabled[p.name] && existsSync3(path4.join(p.installPath, "hooks", "hooks.json")) && existsSync3(path4.join(p.installPath, "dist", "hook.js")));
  out.push(live ? { status: "PASS", name: "hooks", detail: `${live.name} hooks present in ${live.installPath}` } : { status: "WARN", name: "hooks", detail: ours.length ? `${ours[0].name} installed but not enabled or its cache lacks hooks/hooks.json + dist/hook.js` : "project-memory plugin not installed in the plugin cache" });
  const collisions = [];
  for (const p of installed) {
    if (!enabled[p.name] || p.name.startsWith("project-memory@")) continue;
    const hooks = readJsonFile(path4.join(p.installPath, "hooks", "hooks.json"))?.hooks ?? {};
    if ((hooks.PreToolUse ?? []).some((e) => matchesAgent(e?.matcher))) collisions.push(`${p.name}: PreToolUse matcher covers Agent`);
    if ((hooks.SubagentStart ?? []).length) collisions.push(`${p.name}: SubagentStart hook`);
  }
  if (collisions.length) for (const c of collisions) out.push({ status: "WARN", name: "collision", detail: c });
  else out.push({ status: "PASS", name: "collision", detail: "no other enabled plugin hooks PreToolUse Agent or SubagentStart" });
  return out;
}
function liveChecks(r) {
  const pf = (ok, name, pass, fail) => ({ status: ok ? "PASS" : "FAIL", name, detail: ok ? pass : fail });
  return [
    pf(r.postToolUseReplaced, "live:offload", "PostToolUse replaced the 24K-char `seq 1 5000` output with the head+tail placeholder", "placeholder not found in the Bash tool result (see log)"),
    pf(r.subagentBriefSeen, "live:subagent", "subagent echoed the pointer brief (recall(id))", "subagent reply did not carry recall(id) (see log)"),
    pf(r.capTruncates, "live:10k-cap", "12,000-char SessionStart brief: head marker seen, tail marker lost; fit-by-measure stays mandatory", "cap behaviour differs from DESIGN \xA71 rule 5 (see log)"),
    !r.auditWritten ? { status: "FAIL", name: "live:audit", detail: "PostCompact did not write audit.json after the forced /compact (see log)" } : r.auditBeforeRestore ? { status: "PASS", name: "live:audit-order", detail: "forced /compact: PostCompact wrote audit.json before SessionStart(compact), so omissions reach the restore brief" } : { status: "INFO", name: "live:audit-order", detail: "forced /compact: SessionStart(compact) fired before PostCompact on this Claude Code, so the restore brief is built from task-state.json alone (DESIGN \xA73.5 fallback); audit.json was written afterwards" },
    { status: "INFO", name: "live:wall", detail: `${(r.wallMs / 1e3).toFixed(1)} s for two headless claude-haiku-5-5 runs` }
  ];
}
function doctor(home2, opts = {}) {
  const checks = doctorChecks(home2);
  const print = (c) => process.stdout.write(`${c.status.padEnd(4)}  ${c.name.padEnd(18)} ${c.detail}
`);
  for (const c of checks) print(c);
  if (opts.live) {
    const v = spawnSync2("claude", ["--version"], { encoding: "utf8" });
    process.stdout.write(`
live marker test (two headless runs, about two minutes)...
`);
    const r = runLiveTest();
    const live = liveChecks(r);
    checks.push(...live);
    print({ status: "INFO", name: "live:claude", detail: v.status === 0 ? v.stdout.trim() : "claude not found on PATH" });
    for (const c of live) print(c);
    process.stdout.write(`${live.some((c) => c.status === "FAIL") ? r.log : r.log.split("\n")[0]}
`);
  }
  if (opts.baseline) {
    const dir = path4.join(home2, ".claude", "projects");
    if (!existsSync3(dir)) process.stdout.write(`
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
import { existsSync as existsSync6, readFileSync as readFileSync7, readdirSync as readdirSync3, statSync as statSync4, rmSync, mkdirSync as mkdirSync3, cpSync } from "node:fs";
import path6 from "node:path";

// src/cli/backup.ts
import { copyFileSync, existsSync as existsSync5, readFileSync as readFileSync6 } from "node:fs";

// src/lib/atomic.ts
import { writeFileSync as writeFileSync4, readFileSync as readFileSync5, renameSync as renameSync2, realpathSync, existsSync as existsSync4, statSync as statSync3, chmodSync, unlinkSync as unlinkSync2 } from "node:fs";
import path5 from "node:path";
import { randomBytes } from "node:crypto";
function writeFileAtomic(filePath, data) {
  const dir = realpathSync(path5.dirname(filePath));
  const target = path5.join(dir, path5.basename(filePath));
  const tmp = path5.join(dir, `.${path5.basename(filePath)}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`);
  const mode = existsSync4(target) ? statSync3(target).mode & 511 : void 0;
  writeFileSync4(tmp, data, "utf8");
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
  if (existsSync5(file)) copyFileSync(file, `${file}.bak-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}`);
}
function backupAndWriteJson(file, value2) {
  backupFile(file);
  writeFileAtomic(file, JSON.stringify(value2, null, 2) + "\n");
}
function editJson(file, mutate) {
  const j = existsSync5(file) ? JSON.parse(readFileSync6(file, "utf8")) : {};
  mutate(j);
  backupAndWriteJson(file, j);
}

// src/cli/cleanup.ts
var readJsonFile2 = (f) => existsSync6(f) ? JSON.parse(readFileSync7(f, "utf8")) : {};
function onPath(cmd2) {
  if (cmd2.includes("/") || cmd2.includes("\\")) return existsSync6(cmd2);
  const exts = process.platform === "win32" ? ["", ...(process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")] : [""];
  return (process.env.PATH ?? "").split(path6.delimiter).some((dir) => dir && exts.some((e) => existsSync6(path6.join(dir, cmd2 + e))));
}
function deadPath(arg) {
  if (typeof arg !== "string" || !path6.isAbsolute(arg) || arg.length < 2) return false;
  if (!existsSync6(arg)) return true;
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
  const settingsPath = path6.join(home2, ".claude", "settings.json");
  const claudeJson = path6.join(home2, ".claude.json");
  const settings = readJsonFile2(settingsPath);
  const cj = readJsonFile2(claudeJson);
  const plugins = settings.enabledPlugins ?? {};
  const disable = (name, reason) => actions.push({ id: `plugin:${name}`, kind: "disable-plugin", target: name, reason, apply: () => editJson(settingsPath, (s) => {
    s.enabledPlugins = { ...s.enabledPlugins ?? {}, [name]: false };
  }) });
  if (plugins["agentmemory@agentmemory"]) disable("agentmemory@agentmemory", "12 hooks post to a dead localhost:3111 on every prompt");
  if ("claude-supermemory@supermemory-plugins" in plugins) disable("claude-supermemory@supermemory-plugins", plugins["claude-supermemory@supermemory-plugins"] ? "unused hosted memory plugin" : "unused hosted memory plugin (already disabled)");
  if (plugins["context-mode@context-mode"]) actions.push(flag("plugin:context-mode", "context-mode@context-mode", "retire after offload passes acceptance (its PreToolUse Agent rewrite collides with subagent briefs)"));
  for (const [name, def] of Object.entries(cj.mcpServers ?? {})) {
    if (name === "agentmemory") {
      actions.push({ id: `mcp:${name}`, kind: "remove-mcp", target: name, reason: "backend not running; replaced by project-memory", apply: () => editJson(claudeJson, (j) => {
        if (j.mcpServers) delete j.mcpServers[name];
      }) });
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
  const am = path6.join(home2, ".agentmemory");
  if (existsSync6(am)) actions.push({ id: "dir:.agentmemory", kind: "remove-dir", target: am, reason: "agentmemory state; its backups/ are copied to ~/.project-memory/imports/agentmemory first", apply: () => {
    const src = path6.join(am, "backups");
    const dest = path6.join(home2, ".project-memory", "imports", "agentmemory", "backups");
    if (existsSync6(src)) {
      mkdirSync3(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
    }
    rmSync(am, { recursive: true, force: true });
  } });
  return actions;
}

// src/cli/setup.ts
import os2 from "node:os";
import path7 from "node:path";
import { existsSync as existsSync7, readFileSync as readFileSync8, appendFileSync } from "node:fs";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var defaultDeviceId = (host = os2.hostname()) => host.split(".")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-");
var HEADING = "## Compaction instructions (project-memory)";
function compactionInstructionsPath() {
  const here = path7.dirname(fileURLToPath2(import.meta.url));
  return [path7.join(here, "..", "skills", "kb", "compaction-instructions.md"), path7.join(here, "..", "..", "skills", "kb", "compaction-instructions.md")].find(existsSync7) ?? path7.join(here, "..", "skills", "kb", "compaction-instructions.md");
}
function setup(home2, opts = {}) {
  const print = opts.print ?? ((l) => process.stdout.write(l + "\n"));
  const settingsPath = path7.join(home2, ".claude", "settings.json");
  const settings = existsSync7(settingsPath) ? JSON.parse(readFileSync8(settingsPath, "utf8")) : {};
  if (settings.autoCompactWindow === 2e5) print(`autoCompactWindow already 200000 in ${settingsPath}`);
  else {
    editJson(settingsPath, (s) => {
      s.autoCompactWindow = 2e5;
    });
    print(`set autoCompactWindow: 200000 in ${settingsPath} (backup written)`);
  }
  const deviceId = defaultDeviceId(opts.device ?? os2.hostname());
  paths.saveConfig({ deviceId });
  print(`deviceId: ${deviceId} (${paths.configPath()})`);
  const instructions = compactionInstructionsPath();
  const claudeMd = path7.join(home2, ".claude", "CLAUDE.md");
  if (!opts.appendClaudeMd) {
    print(`compaction instructions: ${instructions}`);
    print("  run `kb setup --append-claude-md` to append them to ~/.claude/CLAUDE.md");
    return;
  }
  if (existsSync7(claudeMd) && readFileSync8(claudeMd, "utf8").includes(HEADING)) {
    print(`${claudeMd} already carries the compaction instructions`);
    return;
  }
  backupFile(claudeMd);
  appendFileSync(claudeMd, `
${HEADING}

${readFileSync8(instructions, "utf8")}`);
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
var usage = "usage: kb doctor [--baseline] [--live] | kb cleanup [--apply] | kb setup [--device <name>] [--append-claude-md]\n";
if (cmd === "doctor") process.exitCode = doctor(home, { baseline: has("--baseline"), live: has("--live") });
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
