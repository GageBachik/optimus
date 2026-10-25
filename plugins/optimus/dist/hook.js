#!/usr/bin/env node
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/atomic.ts
import { writeFileSync, readFileSync, renameSync, realpathSync, existsSync, statSync, chmodSync, unlinkSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}
function writeFileAtomic(filePath, data) {
  const dir = realpathSync(path.dirname(filePath));
  const target = path.join(dir, path.basename(filePath));
  const tmp = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`);
  const mode = existsSync(target) ? statSync(target).mode & 511 : void 0;
  writeFileSync(tmp, data, "utf8");
  if (mode !== void 0) chmodSync(tmp, mode);
  let lastErr;
  for (let i = 0; i < 5; i++) {
    try {
      renameSync(tmp, target);
      return;
    } catch (e) {
      lastErr = e;
      if (!["EPERM", "EBUSY", "ENOENT"].includes(e?.code)) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  try {
    unlinkSync(tmp);
  } catch {
  }
  throw lastErr;
}
var init_atomic = __esm({
  "src/lib/atomic.ts"() {
    "use strict";
  }
});

// src/lib/paths.ts
import os from "node:os";
import path2 from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { mkdirSync, existsSync as existsSync2, readFileSync as readFileSync2, realpathSync as realpathSync2, renameSync as renameSync2 } from "node:fs";
function ensure(p) {
  if (!existsSync2(p)) mkdirSync(p, { recursive: true });
  return p;
}
var safe, canonical, paths;
var init_paths = __esm({
  "src/lib/paths.ts"() {
    "use strict";
    init_atomic();
    safe = (s) => s.replace(/[^A-Za-z0-9_-]/g, "_");
    canonical = (p) => {
      const r = path2.resolve(p);
      try {
        return realpathSync2.native(r);
      } catch {
        return r;
      }
    };
    paths = {
      /** `~/.optimus` (or `OPTIMUS_HOME`). The plugin was called project-memory until 2026-10-20: an existing `~/.project-memory` with no `~/.optimus` beside it is renamed once. */
      stateDir() {
        if (!process.env.OPTIMUS_HOME) {
          const home = os.homedir(), old = path2.join(home, ".project-memory"), now = path2.join(home, ".optimus");
          if (existsSync2(old) && !existsSync2(now)) {
            try {
              renameSync2(old, now);
            } catch {
            }
          }
        }
        return ensure(path2.normalize(process.env.OPTIMUS_HOME ?? path2.join(os.homedir(), ".optimus")));
      },
      blobsDir() {
        return ensure(path2.join(this.stateDir(), "blobs"));
      },
      sessionDir(sessionId, agentId = "main") {
        return ensure(path2.join(this.stateDir(), "sessions", safe(sessionId), safe(agentId)));
      },
      logsDir() {
        return ensure(path2.join(this.stateDir(), "logs"));
      },
      configPath() {
        return path2.join(this.stateDir(), "config.json");
      },
      config() {
        try {
          const c = JSON.parse(readFileSync2(this.configPath(), "utf8"));
          return c && typeof c === "object" && !Array.isArray(c) ? c : {};
        } catch {
          return {};
        }
      },
      saveConfig(patch) {
        writeFileAtomic(this.configPath(), JSON.stringify({ ...this.config(), ...patch }, null, 2) + "\n");
      },
      // the retrying rename: a reader holding config.json open on Windows makes a bare renameSync throw EPERM
      bankDir() {
        return path2.normalize(process.env.OPTIMUS_BANK ?? this.config().bankDir ?? path2.join(os.homedir(), "knowledge-bank"));
      },
      projectKey(cwd) {
        const start = canonical(cwd);
        let dir = start;
        for (let i = 0; i < 8; i++) {
          const f = path2.join(dir, ".kb.json");
          if (existsSync2(f)) {
            try {
              const id = JSON.parse(readFileSync2(f, "utf8")).project_id;
              if (typeof id === "string" && id) return id;
            } catch {
            }
          }
          const up = path2.dirname(dir);
          if (up === dir) break;
          dir = up;
        }
        return createHash("sha256").update(start).digest("hex").slice(0, 16);
      },
      projectDir(key) {
        return ensure(path2.join(this.stateDir(), "projects", safe(key)));
      },
      /** v1.5: the runnable kb command for text a session will execute. There is no `kb` on PATH unless the user aliased it (README), so
       *  briefs say `node <plugin>/dist/kb.js`: next to this bundle in dist/, or the plugin's dist/ when running from src/ under tsx. */
      kbCli() {
        const here = path2.dirname(fileURLToPath(import.meta.url));
        for (const c of [path2.join(here, "kb.js"), path2.join(here, "..", "..", "dist", "kb.js")]) if (existsSync2(c)) return `node "${path2.normalize(c).split(path2.sep).join("/")}"`;
        return "kb";
      }
    };
  }
});

// src/lib/log.ts
import { appendFileSync } from "node:fs";
import path3 from "node:path";
function log(level, msg, data) {
  try {
    appendFileSync(path3.join(paths.logsDir(), "hooks.log"), JSON.stringify({ t: (/* @__PURE__ */ new Date()).toISOString(), level, msg, data }) + "\n", "utf8");
  } catch {
  }
}
var init_log = __esm({
  "src/lib/log.ts"() {
    "use strict";
    init_paths();
  }
});

// src/lib/budget.ts
function charSafePrefix(s, n) {
  if (s.length <= n) return s;
  let end = Math.max(0, n);
  const c = s.charCodeAt(end - 1);
  if (c >= 55296 && c <= 56319) end--;
  return s.slice(0, end);
}
function render(preamble, sections, dropped) {
  const parts = [preamble.trim()];
  for (const s of sections) {
    if (!s.items.length) continue;
    parts.push(`## ${s.title}`);
    for (const it of s.items) parts.push(`- ${it}`);
  }
  if (dropped) parts.push(`[${dropped} items omitted]`);
  return parts.join("\n");
}
function fitBrief(preamble, sections, limitChars = 9e3) {
  const work = sections.map((s) => ({ ...s, items: [...s.items] })).sort((a, b) => b.priority - a.priority);
  let dropped = 0, truncated = false, text = render(preamble, work, 0);
  while (text.length > limitChars) {
    const nonEmpty = work.filter((s) => s.items.length);
    const only = nonEmpty[0];
    if (nonEmpty.length === 1 && only && only.items.length === 1) {
      const item = only.items[0] ?? "";
      const over = text.length - limitChars + 20;
      only.items[0] = charSafePrefix(item, Math.max(0, item.length - over)) + " [brief truncated]";
      truncated = true;
      text = render(preamble, work, dropped);
      break;
    }
    const victim = [...work].reverse().find((s) => s.items.length);
    if (!victim) break;
    victim.items.pop();
    dropped++;
    text = render(preamble, work, dropped);
  }
  if (text.length > limitChars) {
    text = charSafePrefix(text, limitChars - 20) + "\n[brief truncated]";
    truncated = true;
  }
  return { text, dropped, truncated };
}
var init_budget = __esm({
  "src/lib/budget.ts"() {
    "use strict";
  }
});

// src/lib/session-state.ts
import { readFileSync as readFileSync3, rmSync } from "node:fs";
import path4 from "node:path";
function loadState(sessionId, agentId = "main") {
  try {
    return { ...empty(), ...JSON.parse(readFileSync3(path4.join(paths.sessionDir(sessionId, agentId), "state.json"), "utf8")) };
  } catch {
    return empty();
  }
}
function saveState(sessionId, s, agentId = "main") {
  writeFileAtomic(path4.join(paths.sessionDir(sessionId, agentId), "state.json"), JSON.stringify(s, null, 2) + "\n");
}
function deleteSession(sessionId) {
  rmSync(path4.dirname(paths.sessionDir(sessionId)), { recursive: true, force: true });
}
var empty;
var init_session_state = __esm({
  "src/lib/session-state.ts"() {
    "use strict";
    init_paths();
    init_atomic();
    empty = () => ({ seenBlobs: [], lastSnapshotOffset: 0, snapshots: [], briefed: [], startedAt: (/* @__PURE__ */ new Date()).toISOString() });
  }
});

// src/lib/transcript.ts
import { openSync, readSync, fstatSync, closeSync } from "node:fs";
function readTranscript(path20, fromOffset = 0) {
  const fd = openSync(path20, "r");
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
function textOf(e) {
  return blocks(e).filter((b) => b?.type === "text").map((b) => String(b.text)).join("\n").replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim();
}
var init_transcript = __esm({
  "src/lib/transcript.ts"() {
    "use strict";
  }
});

// src/lib/redaction.ts
function redactSensitive(text) {
  if (text.length > MAX_CHARS) return { text: `[REDACTED:oversize ${text.length} chars]`, count: 1 };
  let count = 0;
  for (const { kind, re, group } of PATTERNS) {
    text = text.replace(re, (m, ...g) => {
      count++;
      const tag = `[REDACTED:${kind}]`;
      return group ? m.slice(0, m.length - g[group - 1].length) + tag : tag;
    });
  }
  return { text, count };
}
var PATTERNS, MAX_CHARS, redactJson;
var init_redaction = __esm({
  "src/lib/redaction.ts"() {
    "use strict";
    PATTERNS = [
      { kind: "aws", re: /\bAKIA[0-9A-Z]{16}\b/g },
      { kind: "github", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
      { kind: "anthropic", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
      { kind: "openai", re: /\bsk-[A-Za-z0-9]{32,}\b/g },
      { kind: "slack", re: /\bxox[abpr]-[A-Za-z0-9-]{10,}/g },
      { kind: "stripe", re: /\bsk_(live|test)_[A-Za-z0-9]{16,}\b/g },
      { kind: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
      { kind: "pem", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
      { kind: "bearer", re: /\bBearer\s+([A-Za-z0-9._~+\/=\-]{16,})/g, group: 1 },
      { kind: "generic", re: /\b(api[_-]?key|secret|token|passphrase|password)\s*[:=]\s*["']?([A-Za-z0-9\/+_\-]{16,})/gi, group: 2 }
    ];
    MAX_CHARS = 1e6;
    redactJson = (_k, v) => typeof v === "string" ? redactSensitive(v).text : v;
  }
});

// src/compaction/task-state.ts
import path5 from "node:path";
import { existsSync as existsSync3 } from "node:fs";
function promptText(e) {
  if (e.type !== "user" || e.isMeta || e.isCompactSummary || e.origin?.kind === "task-notification") return "";
  const t = textOf(e);
  if (/^<(task-notification|local-command-)/.test(t)) return "";
  if (t.startsWith("<command-name>")) return /<command-args>([\s\S]*?)<\/command-args>/.exec(t)?.[1].trim() ?? "";
  return t;
}
function extractTaskState(entries, pointers) {
  const users = entries.map(promptText).filter(Boolean);
  const assistants = entries.filter((e) => e.type === "assistant");
  const constraints = [], decisions = [], files = /* @__PURE__ */ new Map(), commands = [], tests = [], errors = [], values = [];
  let openItems = [];
  for (const u of users) for (const line of u.split("\n")) if (/\b(must|never|always|only|don't|do not)\b/i.test(line)) constraints.push(cap(line.trim(), 200));
  for (const a of assistants) for (const line of textOf(a).split("\n")) if (/^(Decision|Decided|We will|Chosen|Verdict)\b/i.test(line.trim())) decisions.push(cap(line.trim(), 240));
  const results = /* @__PURE__ */ new Map();
  for (const e of entries) for (const b of blocks(e)) if (b?.type === "tool_result") results.set(String(b.tool_use_id), typeof b.content === "string" ? b.content : JSON.stringify(b.content));
  for (const e of entries) for (const b of blocks(e)) {
    if (b?.type !== "tool_use") continue;
    const at = String(e.timestamp ?? "");
    const inp = b.input ?? {};
    if (["Write", "Edit", "NotebookEdit", "MultiEdit"].includes(b.name) && inp.file_path) {
      const p = String(inp.file_path);
      files.delete(p);
      files.set(p, { action: b.name, at });
    }
    if (b.name === "Bash" && inp.command) {
      const cmd = cap(String(inp.command), 120);
      commands.push({ cmd, at });
      if (TEST_RE.test(cmd)) {
        const out2 = results.get(String(b.id)) ?? "";
        const last = out2.trim().split("\n").filter(Boolean).pop() ?? "";
        tests.push({ cmd, lastLine: cap(last, 160) });
      }
    }
    if ((b.name === "TodoWrite" || b.name === "TaskCreate") && Array.isArray(inp.todos)) openItems = inp.todos.filter((t) => t.status !== "completed").map((t) => cap(String(t.content ?? t.subject ?? ""), 160));
  }
  const recent = assistants.map(textOf).filter(Boolean).slice(-40).join("\n");
  for (const line of recent.split("\n")) if (/(Error|error:|Traceback|panic|FAIL)/.test(line)) errors.push(cap(line.trim(), 200));
  const reports = [];
  for (const e of entries) for (const b of blocks(e)) if (b?.type === "tool_use" && REPORT_TOOLS.has(b.name)) {
    const r = results.get(String(b.id));
    if (r) reports.push(r.slice(0, 2e4));
  }
  const lines = [...recent.split("\n"), ...reports.slice(-10).join("\n").split("\n")];
  let header = "";
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim(), row = t.startsWith("|");
    if (!row) header = "";
    else if (/^\|?[\s:|-]+\|?$/.test(lines[i + 1]?.trim() ?? "")) {
      header = cells(t);
      continue;
    }
    const v = valueLine(lines[i]);
    if (v) values.push(row && header ? cap(`${header} \u2192 ${v}`, 160) : v);
  }
  const lastAt = new Map(commands.map((c) => [c.cmd, c.at]));
  return {
    goalFirst: cap(users[0] ?? "", 600),
    goalLatest: cap(users.at(-1) ?? "", 600),
    constraints: uniq(constraints).slice(0, 12),
    decisions: uniq(decisions).slice(0, 12),
    files: [...files.entries()].map(([path20, v]) => ({ path: path20, ...v })).slice(-40),
    commands: uniq(commands.map((c) => c.cmd)).slice(-20).map((cmd) => ({ cmd, at: lastAt.get(cmd) })),
    tests: tests.slice(-10),
    openItems: openItems.slice(0, 20),
    errors: uniq(errors).slice(-10),
    exactValues: uniq(values).slice(-40),
    pointers
  };
}
function recallPointers(state) {
  return state.snapshots.map((s) => `snapshot ${s.id} (${s.at}) \u2192 recall(id="${s.id}")`).concat(state.seenBlobs.slice(-3).map((b) => `recent offloaded output \u2192 recall(id="${b.slice(0, 16)}")`));
}
function loadTaskState(sessionId, transcriptPath) {
  const stored = readJson(path5.join(paths.sessionDir(sessionId), "task-state.json"));
  if (stored) return stored;
  if (!transcriptPath || !existsSync3(transcriptPath)) return null;
  return JSON.parse(JSON.stringify(extractTaskState(readTranscript(transcriptPath, 0).entries, recallPointers(loadState(sessionId))), redactJson));
}
function renderTaskState(ts) {
  const sec = (t, items) => items.length ? `## ${t}
${items.map((i) => `- ${i}`).join("\n")}
` : "";
  return [
    `## Goal
- First: ${ts.goalFirst}
- Latest: ${ts.goalLatest}
`,
    sec("Open items", ts.openItems),
    sec("Constraints", ts.constraints),
    sec("Decisions", ts.decisions),
    sec("Files", ts.files.map((f) => `${f.path} (${f.action} ${f.at})`)),
    sec("Exact values", ts.exactValues),
    sec("Tests", ts.tests.map((t) => `${t.cmd} \u2192 ${t.lastLine}`)),
    sec("Commands", ts.commands.map((c) => c.cmd)),
    sec("Errors", ts.errors),
    sec("Pointers", ts.pointers)
  ].filter(Boolean).join("\n");
}
var cap, uniq, TEST_RE, VALUE_RE, BOILERPLATE_RE, cells, valueLine, REPORT_TOOLS;
var init_task_state = __esm({
  "src/compaction/task-state.ts"() {
    "use strict";
    init_transcript();
    init_paths();
    init_atomic();
    init_redaction();
    init_session_state();
    cap = (s, n) => s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
    uniq = (a) => [...new Set(a)];
    TEST_RE = /\b(pytest|vitest|jest|cargo test|npm test|pnpm test|node --test|go test|bun test)\b/;
    VALUE_RE = /\$\d[\d,]*(?:\.\d+)?|\b\d+(?:\.\d+)?\s?(?:%|x\b|(?:ms|s|K|M|GB|MB|KB|tokens|bps|fills|trades|days|bars)\b)|\b\d{4,}(?:\.\d+)?\b|\b[0-9a-f]{7,40}\b/g;
    BOILERPLATE_RE = /^(?:Transcript dir|Script file|To resume|\(Edit this file)\b|internal metadata/;
    cells = (row) => row.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).filter(Boolean).join(" \xB7 ");
    valueLine = (line) => {
      let t = line.trim();
      if (/^\|?[\s:|-]+\|?$/.test(t) || /^`/.test(t) || BOILERPLATE_RE.test(t)) return "";
      if (t.startsWith("|")) t = cells(t);
      t = t.replace(/^(?:[>*•\-]\s+|\d+[.)]\s+)+/, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
      VALUE_RE.lastIndex = 0;
      return t.length >= 12 && t.length <= 400 && VALUE_RE.test(t) ? cap(t, 160) : "";
    };
    REPORT_TOOLS = /* @__PURE__ */ new Set(["Agent", "Workflow", "Task"]);
  }
});

// src/compaction/doctrine.ts
var RESTORE_CHECKLIST;
var init_doctrine = __esm({
  "src/compaction/doctrine.ts"() {
    "use strict";
    RESTORE_CHECKLIST = `KEEP VERBATIM going forward: paths with line numbers, exact errors, exact values, decisions with rationale, open objectives.`;
  }
});

// src/compaction/restore-brief.ts
function buildRestoreBrief(ts, audit, limit = 9e3) {
  const sections = [
    { title: "Goal", priority: 10, items: [`First: ${ts.goalFirst}`, `Latest: ${ts.goalLatest}`] },
    { title: "Open items", priority: 9, items: ts.openItems },
    { title: "Omitted by compaction (re-injected)", priority: 8, items: audit?.missing ?? [] },
    { title: "Constraints", priority: 7, items: ts.constraints },
    { title: "Decisions", priority: 6, items: ts.decisions },
    { title: "Files", priority: 5, items: ts.files.map((f) => `${f.path} (${f.action})`) },
    { title: "Exact values", priority: 4, items: ts.exactValues },
    { title: "Tests", priority: 3, items: ts.tests.map((t) => `${t.cmd} \u2192 ${t.lastLine}`) },
    { title: "Errors", priority: 2, items: ts.errors },
    { title: "Pointers", priority: 1, items: ts.pointers }
  ];
  const { text } = fitBrief(PREAMBLE, sections, limit - RESTORE_CHECKLIST.length - 2);
  return `${text}

${RESTORE_CHECKLIST}`;
}
var PREAMBLE;
var init_restore_brief = __esm({
  "src/compaction/restore-brief.ts"() {
    "use strict";
    init_budget();
    init_doctrine();
    PREAMBLE = "Context restored by the optimus plugin. Items below are a memory aid with source and date, not standing orders; the user's latest message always takes precedence.";
  }
});

// src/kb/db.ts
import { createRequire as requireFrom } from "node:module";
import path6 from "node:path";
function loadSqlite() {
  const emit = process.emitWarning;
  process.emitWarning = ((w, ...rest) => {
    const type = typeof rest[0] === "string" ? rest[0] : rest[0]?.type;
    if (type === "ExperimentalWarning") return;
    return emit.call(process, w, ...rest);
  });
  try {
    return requireFrom(import.meta.url)("node:sqlite");
  } finally {
    process.emitWarning = emit;
  }
}
function openDb(file = path6.join(paths.stateDir(), "kb.sqlite")) {
  const sql = new (loadSqlite()).DatabaseSync(file);
  sql.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON;");
  sql.exec(DDL);
  const ins = sql.prepare("INSERT OR IGNORE INTO rank_weights(key, value) VALUES (?, ?)");
  for (const [k, v] of WEIGHTS) ins.run(k, v);
  return { sql, file };
}
function getNote(db, id) {
  return db.sql.prepare("SELECT * FROM note WHERE id=?").get(id) ?? null;
}
function getAttrs(db, id) {
  const out2 = {};
  for (const r of db.sql.prepare("SELECT key, value FROM attr WHERE note_id=? ORDER BY key, value").all(id)) (out2[r.key] ??= []).push(r.value);
  return out2;
}
function getRels(db, id, dir = "out") {
  const where = dir === "out" ? "src=?" : dir === "in" ? "dst=?" : "(src=? OR dst=?)";
  const args = dir === "both" ? [id, id] : [id];
  return db.sql.prepare(`SELECT * FROM rel WHERE ${where} AND deleted_at IS NULL ORDER BY created_at`).all(...args).map((r) => ({ ...r, props: JSON.parse(r.props) }));
}
var DDL, WEIGHTS;
var init_db = __esm({
  "src/kb/db.ts"() {
    "use strict";
    init_paths();
    DDL = `
CREATE TABLE IF NOT EXISTS note(id TEXT PRIMARY KEY, kind TEXT NOT NULL, domain TEXT, project TEXT, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, device_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attr(note_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(note_id, key, value));
CREATE INDEX IF NOT EXISTS attr_kv ON attr(key, value);
CREATE TABLE IF NOT EXISTS rel(id TEXT PRIMARY KEY, src TEXT NOT NULL, type TEXT NOT NULL, dst TEXT NOT NULL, props TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, deleted_at TEXT);
CREATE INDEX IF NOT EXISTS rel_src ON rel(src, type); CREATE INDEX IF NOT EXISTS rel_dst ON rel(dst, type);
CREATE TABLE IF NOT EXISTS alias(name_norm TEXT PRIMARY KEY, concept_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pending_merge(id TEXT PRIMARY KEY, a TEXT NOT NULL, b TEXT NOT NULL, score REAL NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, resolved TEXT);
CREATE TABLE IF NOT EXISTS rank_weights(key TEXT PRIMARY KEY, value REAL NOT NULL);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(note_id UNINDEXED, title, body, tokenize='porter unicode61');`;
    WEIGHTS = [["facet_value", 3], ["facet_key", 1], ["environment", 2], ["subject", 2], ["gate_rank", 1], ["recency", 1], ["transfer_confirmed", 2], ["transfer_refuted", -2], ["conflict", -3], ["expired_factor", 0.5]];
  }
});

// src/kb/project.ts
import { existsSync as existsSync4, readFileSync as readFileSync4 } from "node:fs";
import path7 from "node:path";
function loadProjectConfig(cwd) {
  let dir = path7.resolve(cwd);
  for (let i = 0; i < 8; i++) {
    const f = path7.join(dir, ".kb.json");
    if (existsSync4(f)) {
      let c;
      try {
        c = JSON.parse(readFileSync4(f, "utf8"));
      } catch (e) {
        log("warn", `.kb.json at ${f} is not valid JSON; ignored`, String(e));
        return null;
      }
      if (!c.project_id || !c.domain) {
        log("warn", `.kb.json at ${f} lacks project_id or domain; ignored`);
        return null;
      }
      return c;
    }
    const up = path7.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
var init_project = __esm({
  "src/kb/project.ts"() {
    "use strict";
    init_log();
  }
});

// src/kb/normalize.ts
function measure(w) {
  let m = 0, i = 0;
  const n = w.length;
  while (i < n && isCons(w, i)) i++;
  while (i < n) {
    while (i < n && !isCons(w, i)) i++;
    if (i >= n) break;
    while (i < n && isCons(w, i)) i++;
    m++;
  }
  return m;
}
function rule(w, pairs, cond) {
  for (const [s, r] of pairs) if (w.endsWith(s)) {
    const stem2 = w.slice(0, -s.length);
    return cond(stem2) ? stem2 + r : w;
  }
  return w;
}
function stem(word) {
  let w = word;
  if (w.length <= 2) return w;
  if (w.endsWith("sses") || w.endsWith("ies")) w = w.slice(0, -2);
  else if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) w = w.slice(0, -1);
  if (w.endsWith("eed")) {
    if (measure(w.slice(0, -3)) > 0) w = w.slice(0, -1);
  } else {
    const suf = w.endsWith("ed") ? 2 : w.endsWith("ing") ? 3 : 0;
    const base = w.slice(0, -suf);
    if (suf && hasVowel(base)) {
      w = base;
      if (w.endsWith("at") || w.endsWith("bl") || w.endsWith("iz")) w += "e";
      else if (doubleCons(w) && !"lsz".includes(w.at(-1))) w = w.slice(0, -1);
      else if (measure(w) === 1 && cvc(w)) w += "e";
    }
  }
  if (w.endsWith("y") && hasVowel(w.slice(0, -1))) w = w.slice(0, -1) + "i";
  w = rule(w, STEP2, (s) => measure(s) > 0);
  w = rule(w, STEP3, (s) => measure(s) > 0);
  const s4 = STEP4.filter((s) => w.endsWith(s)).sort((a, b) => b.length - a.length)[0];
  if (s4) {
    const st = w.slice(0, -s4.length);
    if (measure(st) > 1 && (s4 !== "ion" || /[st]$/.test(st))) w = st;
  }
  if (w.endsWith("e")) {
    const st = w.slice(0, -1);
    const m = measure(st);
    if (m > 1 || m === 1 && !cvc(st)) w = st;
  }
  if (measure(w) > 1 && doubleCons(w) && w.endsWith("l")) w = w.slice(0, -1);
  return w;
}
function tokens(name) {
  const parts = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[\s\-_]+/).map((t) => t.replace(/[^a-z0-9]/g, ""));
  return [...new Set(parts.filter((t) => t && !STOP.has(t)).map(stem))].sort();
}
var STOP, isCons, hasVowel, doubleCons, cvc, P, STEP2, STEP3, STEP4, normalizeName;
var init_normalize = __esm({
  "src/kb/normalize.ts"() {
    "use strict";
    STOP = new Set("a an and are as at be by for from has have in is it its of on or that the this to was were will with".split(" "));
    isCons = (w, i) => {
      const c = w[i];
      if ("aeiou".includes(c)) return false;
      return c === "y" ? i === 0 || !isCons(w, i - 1) : true;
    };
    hasVowel = (w) => [...w].some((_, i) => !isCons(w, i));
    doubleCons = (w) => w.length >= 2 && w.at(-1) === w.at(-2) && isCons(w, w.length - 1);
    cvc = (w) => {
      const n = w.length;
      return n >= 3 && isCons(w, n - 3) && !isCons(w, n - 2) && isCons(w, n - 1) && !"wxy".includes(w[n - 1]);
    };
    P = (s) => s.split(" ").map((p) => p.split(">"));
    STEP2 = P("ational>ate tional>tion enci>ence anci>ance izer>ize bli>ble alli>al entli>ent eli>e ousli>ous ization>ize ation>ate ator>ate alism>al iveness>ive fulness>ful ousness>ous aliti>al iviti>ive biliti>ble logi>log");
    STEP3 = P("icate>ic ative> alize>al iciti>ic ical>ic ful> ness>");
    STEP4 = "al ance ence er ic able ible ant ement ment ent ion ou ism ate iti ous ive ize".split(" ");
    normalizeName = (name) => tokens(name).join("-");
  }
});

// src/kb/templates.ts
function templateFor(db, domain) {
  const a = {};
  for (const r of db.sql.prepare("SELECT key, value FROM attr WHERE note_id=? ORDER BY rowid").all(templateNoteId(domain))) (a[r.key] ??= []).push(r.value);
  if (!a.facet) return null;
  const gates = Object.entries(a).filter(([k]) => k.startsWith("gate:")).sort(([x], [y]) => Number(x.slice(5)) - Number(y.slice(5))).map(([, v]) => v[0]);
  return { domain, facets: a.facet, methods: a.method ?? [], gates, environment: a.env_axis?.[0] ?? "environment", subject: a.subject_axis?.[0] ?? "subject", seed_concepts: [], keywords: a.keyword ?? [] };
}
var slug, templateNoteId, conceptNoteId, installedDomains;
var init_templates = __esm({
  "src/kb/templates.ts"() {
    "use strict";
    init_db();
    init_normalize();
    slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    templateNoteId = (domain) => `m_${slug(domain).padEnd(26, "0").slice(0, 26)}`;
    conceptNoteId = (name) => `c_${normalizeName(name).replace(/-/g, "").padEnd(26, "0").slice(0, 26)}`;
    installedDomains = (db) => db.sql.prepare("SELECT domain FROM note WHERE kind='template' AND deleted_at IS NULL AND domain IS NOT NULL ORDER BY domain").all().map((r) => r.domain);
  }
});

// src/kb/rank.ts
function conceptIds(db, names) {
  const q = db.sql.prepare("SELECT concept_id FROM alias WHERE name_norm=?"), title = db.sql.prepare("SELECT title FROM note WHERE id=?");
  const slot = (n) => {
    const id = conceptNoteId(n), t = title.get(id)?.title;
    return t === void 0 || normalizeName(t) === normalizeName(n) ? id : void 0;
  };
  return [...new Set(names.map((n) => q.get(normalizeName(n))?.concept_id ?? slot(n)))].filter((id) => !!id);
}
function findingsAbout(db, concepts) {
  if (!concepts.length) return [];
  return ids(db.sql.prepare(`SELECT DISTINCT n.id FROM rel r JOIN note n ON n.id=r.src WHERE r.type='about' AND r.deleted_at IS NULL AND r.dst IN (${marks(concepts)}) AND ${LIVE_FINDING}`).all(...concepts));
}
function findingsAboutIn(db, concepts, domain) {
  if (!concepts.length) return [];
  const all = findingsAbout(db, concepts);
  if (!domain) return all;
  const own = new Set(ids(db.sql.prepare(`SELECT DISTINCT n.id FROM rel r JOIN note n ON n.id=r.src WHERE r.type='about' AND r.deleted_at IS NULL AND r.dst IN (${marks(concepts)}) AND n.domain=? AND ${LIVE_FINDING}`).all(...concepts, domain)));
  return [...all.filter((id) => own.has(id)), ...all.filter((id) => !own.has(id))];
}
function findingsByTitlePhrase(db, prompt, domain, limit = 3) {
  const toks = prompt.toLowerCase().replace(/\S*[\\/]\S+/g, " ").split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP2.has(t));
  const phrases = [...new Set(toks.slice(0, -1).map((t, i) => `${t} ${toks[i + 1]}`))].slice(0, 80);
  const q = db.sql.prepare(`SELECT n.id, n.domain FROM note_fts f JOIN note n ON n.id=f.note_id WHERE note_fts MATCH ? AND ${LIVE_FINDING} ORDER BY CASE WHEN n.domain=? THEN 0 ELSE 1 END, n.id LIMIT ?`);
  const own = [], other = [], hit = [];
  for (const p of phrases) {
    const rows = q.all(`title:"${p}"`, domain ?? null, limit);
    if (rows.length) hit.push(p);
    for (const r of rows) if (!own.includes(r.id) && !other.includes(r.id)) (domain && r.domain === domain ? own : other).push(r.id);
    if ((domain ? own : other).length >= limit) break;
  }
  return { ids: [...own, ...other].slice(0, limit), phrases: hit };
}
function findingsIn(db, projects) {
  if (!projects.length) return [];
  return ids(db.sql.prepare(`SELECT n.id FROM note n WHERE n.project IN (${marks(projects)}) AND ${LIVE_FINDING}`).all(...projects));
}
function candidateIds(db, cfg) {
  const out2 = new Set(findingsAbout(db, conceptIds(db, cfg.relies_on ?? [])));
  const keys = Object.keys(cfg.facets ?? {}).map((k) => `facet:${k}`);
  if (keys.length) for (const id of ids(db.sql.prepare(`SELECT DISTINCT n.id FROM rel r JOIN note n ON n.id=r.src JOIN note ap ON ap.id=r.dst AND ap.kind='approach' AND ap.deleted_at IS NULL
    JOIN attr a ON a.note_id=ap.id AND a.key IN (${marks(keys)}) WHERE r.type='about' AND r.deleted_at IS NULL AND ${LIVE_FINDING}`).all(...keys))) out2.add(id);
  const want = { environment: cfg.target?.environment, subject: cfg.target?.subject };
  if (want.environment || want.subject) {
    const axes = db.sql.prepare(`SELECT a.note_id AS id, a.key, a.value FROM attr a JOIN note t ON t.id=a.note_id AND t.kind='target' AND t.deleted_at IS NULL WHERE a.key IN ('facet:environment','facet:subject')`).all();
    const targets = [...new Set(axes.filter((r) => {
      const w = want[r.key.slice(6)];
      return w && normalizeName(w) === normalizeName(r.value);
    }).map((r) => r.id))];
    if (targets.length) for (const id of ids(db.sql.prepare(`SELECT DISTINCT n.id FROM rel r JOIN note n ON n.id=r.src WHERE r.type='validated_in' AND r.deleted_at IS NULL AND r.dst IN (${marks(targets)}) AND ${LIVE_FINDING}`).all(...targets))) out2.add(id);
  }
  if (!out2.size && cfg.domain && cfg.auto?.confidence !== "low") for (const id of ids(db.sql.prepare(`SELECT n.id FROM note n WHERE n.domain=? AND ${LIVE_FINDING}`).all(cfg.domain))) out2.add(id);
  return [...out2];
}
function loadCandidates(db, findingIds) {
  const note = db.sql.prepare("SELECT id, title, project, domain, updated_at FROM note WHERE id=? AND deleted_at IS NULL");
  const out2 = [];
  for (const id of new Set(findingIds)) {
    const n = note.get(id);
    if (!n) continue;
    const rels = getRels(db, id, "both");
    const c = { ...n, attrs: getAttrs(db, id), facets: {}, target: { environment: [], subject: [] }, transfers: { confirmed: 0, refuted: 0 }, conflicts: 0, proposals: [], evidence: [] };
    for (const r of rels) {
      if (r.type === "conflicts_with") {
        c.conflicts++;
        continue;
      }
      if (r.src !== id) continue;
      if (r.type === "transfer") {
        if (r.props.state === "confirmed") c.transfers.confirmed++;
        else if (r.props.state === "refuted") c.transfers.refuted++;
        else c.proposals.push({ id: r.id, state: String(r.props.state), project: getNote(db, r.dst)?.project ?? null });
      } else if (r.type === "about" && r.dst.startsWith("a_")) {
        for (const [k, v] of Object.entries(getAttrs(db, r.dst))) if (k.startsWith("facet:")) (c.facets[k.slice(6)] ??= []).push(...v);
      } else if (r.type === "validated_in") {
        const a = getAttrs(db, r.dst);
        c.target.environment.push(...a["facet:environment"] ?? []);
        c.target.subject.push(...a["facet:subject"] ?? []);
      } else if (r.type === "backed_by") c.evidence.push(getNote(db, r.dst)?.title ?? r.dst);
    }
    out2.push(c);
  }
  return out2;
}
function recency(validFrom, today) {
  const days = (today.getTime() - Date.parse(validFrom ?? "")) / 864e5;
  if (Number.isNaN(days)) return 0;
  return days <= 90 ? 1 : days >= 365 ? 0 : (365 - days) / 275;
}
function loadWeights(db) {
  return Object.fromEntries(db.sql.prepare("SELECT key, value FROM rank_weights").all().map((r) => [r.key, r.value]));
}
function scoreFinding(c, cfg, w, today) {
  let s = 0;
  for (const [k, v] of Object.entries(cfg.facets ?? {})) {
    const have = c.facets[k];
    if (have) s += have.includes(v) ? w.facet_value : w.facet_key;
  }
  for (const axis of ["environment", "subject"]) {
    const want = cfg.target?.[axis];
    if (want && c.target[axis].some((x) => normalizeName(x) === normalizeName(want))) s += w[axis];
  }
  s += w.gate_rank * Number(c.attrs.gate_rank?.[0] ?? 0);
  s += w.recency * recency(c.attrs.valid_from?.[0] ?? c.updated_at, today);
  s += w.transfer_confirmed * c.transfers.confirmed + w.transfer_refuted * c.transfers.refuted;
  if (c.conflicts) s += w.conflict;
  return expired(c, today) ? s * w.expired_factor : s;
}
function rankCandidates(db, cands, cfg, today = /* @__PURE__ */ new Date()) {
  const w = loadWeights(db), bare = !Object.keys(cfg.facets ?? {}).length && !cfg.target?.environment && !cfg.target?.subject && !cfg.relies_on?.length;
  const rec = (c) => recency(c.attrs.valid_from?.[0] ?? c.updated_at, today);
  const ranked = cands.map((c) => ({ ...c, score: scoreFinding(c, cfg, w, today), demoted: expired(c, today) })).sort((a, b) => (bare ? rec(b) - rec(a) : 0) || b.score - a.score || cmp(b.updated_at, a.updated_at) || cmp(a.id, b.id));
  const seen = /* @__PURE__ */ new Set();
  return ranked.filter((c) => {
    const k = c.title.toLowerCase().replace(/[^a-z0-9%$.]+/g, " ").trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function rankFindings(db, cfg, limit, today = /* @__PURE__ */ new Date()) {
  const ranked = rankCandidates(db, candidateFindings(db, cfg), cfg, today);
  const bare = !Object.keys(cfg.facets ?? {}).length && !cfg.target?.environment && !cfg.target?.subject && !cfg.relies_on?.length;
  if (!bare) return ranked.slice(0, limit);
  const own = ranked.filter((f) => f.project === cfg.project_id), other = ranked.filter((f) => f.project !== cfg.project_id);
  const out2 = [];
  for (let i = 0; out2.length < limit && (i < own.length || i < other.length); i++) {
    if (i < own.length) out2.push(own[i]);
    if (out2.length < limit && i < other.length) out2.push(other[i]);
  }
  return out2;
}
var NOT_SUPERSEDED, LIVE_FINDING, marks, ids, cmp, STOP2, expired, candidateFindings;
var init_rank = __esm({
  "src/kb/rank.ts"() {
    "use strict";
    init_db();
    init_normalize();
    init_templates();
    NOT_SUPERSEDED = `NOT EXISTS (SELECT 1 FROM rel s JOIN note m ON m.id=s.src AND m.deleted_at IS NULL WHERE s.type='supersedes' AND s.dst=n.id AND s.deleted_at IS NULL)`;
    LIVE_FINDING = `n.kind='finding' AND n.deleted_at IS NULL AND ${NOT_SUPERSEDED}`;
    marks = (xs) => xs.map(() => "?").join(",");
    ids = (rows) => rows.map((r) => r.id);
    cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
    STOP2 = /* @__PURE__ */ new Set(["the", "and", "for", "with", "that", "this", "from", "into", "your", "have", "will", "make", "like", "want", "just", "then", "also", "about", "what", "when", "where", "which", "there", "their", "them", "they", "been", "were", "some", "more", "very", "over", "under", "after", "before", "each", "every", "should", "would", "could", "please", "need", "only", "does", "did", "can", "not", "but", "you", "our", "its", "are", "was", "use", "using", "add", "now", "let", "get"]);
    expired = (c, today) => {
      const to = c.attrs.valid_to?.[0];
      return !!to && Date.parse(to) < today.getTime();
    };
    candidateFindings = (db, cfg) => loadCandidates(db, candidateIds(db, cfg));
  }
});

// src/kb/compare.ts
function compareConcept(db, conceptId, facetKey) {
  const rows = findingsAbout(db, [conceptId]).map((id) => {
    const a = getAttrs(db, id), rels = getRels(db, id);
    let approachValue = null, target = null;
    for (const r of rels) {
      const key = r.props.facet_key;
      if (approachValue === null && r.type === "about" && r.dst.startsWith("a_") && typeof key === "string" && (facetKey === void 0 || key === facetKey) && live(db, r.dst))
        approachValue = getAttrs(db, r.dst)[`facet:${key}`]?.[0] ?? null;
      if (target === null && r.type === "validated_in") target = live(db, r.dst)?.title ?? null;
    }
    const mk = Object.keys(a).find((k) => k.startsWith("metric:"));
    const [v, unit, better] = mk ? a[mk][0].split("|") : [];
    const value = v !== void 0 && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
    return {
      findingId: id,
      approachValue,
      gate: a.gate?.[0] ?? null,
      gateRank: a.gate_rank ? Number(a.gate_rank[0]) : -1,
      metric: mk ? mk.slice(7) : null,
      value,
      unit: unit || null,
      better: better === "higher" || better === "lower" ? better : null,
      target,
      validFrom: a.valid_from?.[0] ?? null,
      state: a.state?.[0] ?? null,
      project: getNote(db, id)?.project ?? null
    };
  });
  const score = (r) => r.value === null ? -Infinity : r.value * (r.better === "lower" ? -1 : 1);
  return rows.sort((x, y) => y.gateRank - x.gateRank || score(y) - score(x) || (x.findingId < y.findingId ? -1 : 1));
}
function compareLine(r, key) {
  const metric = r.metric ? `${r.metric} ${r.value ?? "?"}${r.unit ? ` ${r.unit}` : ""}${r.better ? ` (${r.better} is better)` : ""}` : "no metric";
  const meta = [r.gate && `gate ${r.gate}`, r.target && `target ${r.target}`, r.state, r.validFrom, r.project && `project ${r.project}`].filter(Boolean).join(", ");
  return `${key ? `${key}=${r.approachValue}` : r.approachValue ?? "(no approach facet)"}: ${metric} (${meta}) [${r.findingId}]`;
}
function comparisonSections(db, cfg) {
  const keys = Object.keys(cfg.facets ?? {});
  if (!keys.length) return [];
  const pairs = db.sql.prepare(`SELECT DISTINCT c.dst AS concept, json_extract(p.props, '$.facet_key') AS key, n.title FROM rel p
    JOIN rel c ON c.src=p.src AND c.type='about' AND c.deleted_at IS NULL AND c.dst LIKE 'c\\_%' ESCAPE '\\'
    JOIN note n ON n.id=c.dst AND n.deleted_at IS NULL
    WHERE p.type='about' AND p.deleted_at IS NULL AND p.dst LIKE 'a\\_%' ESCAPE '\\' AND json_extract(p.props, '$.facet_key') IN (${keys.map(() => "?").join(",")})
    ORDER BY n.title, key`).all(...keys);
  const out2 = [];
  for (const p of pairs) {
    const rows = compareConcept(db, p.concept, p.key).filter((r) => r.approachValue !== null);
    if (rows.length >= 2) out2.push({ title: `Comparison: ${p.title} by ${p.key}`, priority: 6, items: rows.map((r) => compareLine(r, p.key)) });
  }
  return out2;
}
var live;
var init_compare = __esm({
  "src/kb/compare.ts"() {
    "use strict";
    init_db();
    init_rank();
    live = (db, id) => {
      const n = getNote(db, id);
      return n && !n.deleted_at ? n : void 0;
    };
  }
});

// src/kb/brief.ts
import path8 from "node:path";
function lastSessionSection(projectKey) {
  const last = readJson(path8.join(paths.projectDir(projectKey), "last-session.json"));
  if (!last) return [];
  const t = last.taskState;
  return [{ title: "Last session in this project", priority: 10, items: [
    `When: ${last.at} (session ${last.sessionId}, in ${last.cwd})`,
    `Goal: ${t.goalFirst}`,
    `Latest: ${t.goalLatest}`,
    ...t.openItems.map((o) => `Open: ${o}`),
    ...t.decisions,
    ...t.files.map((f) => `${f.path} (${f.action})`),
    ...t.pointers
  ] }];
}
function pendingQuestions(db, max = 3) {
  const rows = db.sql.prepare(`SELECT p.id, a.title AS at, b.title AS bt FROM pending_merge p JOIN note a ON a.id=p.a JOIN note b ON b.id=p.b
    WHERE p.resolved IS NULL ORDER BY p.score DESC, p.created_at, p.id LIMIT ?`).all(max);
  return rows.map((r) => `Merge "${r.at}" into "${r.bt}"? ${paths.kbCli()} concepts accept ${r.id} | ${paths.kbCli()} concepts reject ${r.id}`);
}
function fitNotes(f, cfg) {
  const out2 = [], theirs = (xs) => [...new Set(xs)].join("/");
  for (const axis of ["environment", "subject"]) {
    const want = cfg.target?.[axis], have = f.target[axis];
    if (want && have.length && !have.some((x) => normalizeName(x) === normalizeName(want))) out2.push(`your ${axis} differs: ${want} vs ${theirs(have)}`);
  }
  for (const [k, v] of Object.entries(cfg.facets ?? {})) {
    const have = f.facets[k];
    if (have && !have.includes(v)) out2.push(`your ${k} differs: ${v} vs ${theirs(have)}`);
  }
  for (const p of f.proposals) if (p.project === cfg.project_id) out2.push(`transfer ${p.state}: ${paths.kbCli()} transfer ${p.id} confirm|refute`);
  return out2;
}
function findingLine(f, cfg) {
  const a = f.attrs;
  const meta = [a.state?.[0] ?? "unverified", a.gate?.[0] && `gate ${a.gate[0]}`, a.valid_from?.[0] ?? f.updated_at.slice(0, 10), f.project && `project ${f.project}`, cfg?.domain && f.domain && f.domain !== cfg.domain && `domain ${f.domain}`, f.demoted && `expired ${a.valid_to?.[0]}`].filter(Boolean).join(", ");
  const notes = cfg ? fitNotes(f, cfg) : [];
  return `${f.title} (${meta}) [${f.id}] evidence: ${f.evidence.join("; ") || "none"}${notes.length ? ` \u2014 ${notes.join("; ")}` : ""}`;
}
function projectCard(cfg) {
  const t = cfg.target, facets = Object.entries(cfg.facets ?? {}).map(([k, v]) => `${k}=${v}`);
  const parts = [`Domain ${cfg.domain}`, t?.environment || t?.subject ? `target ${t.environment ?? "?"} \xD7 ${t.subject ?? "?"}` : "", facets.length ? `facets ${facets.join(", ")}` : "", cfg.relies_on?.length ? `relies on ${cfg.relies_on.join(", ")}` : ""];
  return { title: `Project ${cfg.project_id}`, priority: 9, items: [`${parts.filter(Boolean).join("; ")}. Large tool outputs are offloaded; recall(id) reopens them exactly. kb_brief({ project: "${cfg.project_id}" }) re-reads this brief; kb_find searches the bank. When you measure a number or learn why something failed, record it as you go: kb_write({ kind: "finding", title: "<one claim with the number>", domain: "${cfg.domain}", project: "${cfg.project_id}", tags: ["<2-3 concept words>"], attrs: { state: "observed" }, evidence: [{ kind: "path", ref: "<file>" }] }).`] };
}
function projectBrief(db, cfg, questions, limit = 9e3, today = /* @__PURE__ */ new Date()) {
  const findings = rankFindings(db, cfg, TOP_FINDINGS, today);
  const memories = db.sql.prepare(`SELECT n.title FROM note n WHERE n.kind='evidence' AND n.project=? AND n.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM attr a WHERE a.note_id=n.id AND a.key='origin' AND a.value IN (${WRITE_ORIGINS.map(() => "?").join(",")}))
    ORDER BY n.updated_at DESC, n.id LIMIT ?`).all(cfg.project_id, ...WRITE_ORIGINS, MEMORY_TITLES).map((m) => m.title);
  const sections = [
    ...lastSessionSection(cfg.project_id),
    projectCard(cfg),
    { title: "Pending concept questions", priority: 8, items: questions.slice(0, 3) },
    { title: "Relevant findings", priority: 7, items: findings.map((f) => findingLine(f, cfg)) },
    // v1.5: the comparison tables themselves stay out of the start-up brief — five of them, all 0DTE and LEAPS metrics from another
    // project, filled an investment-strategy brief to its 9,000-character cap for a question about buying an index fund. One line says
    // which comparisons exist; kb_compare returns a table on demand.
    { title: "Comparisons available", priority: 6, items: comparisonPointer(db, cfg) },
    { title: "Imported memories for this project", priority: 1, items: memories.length ? [`kb_find({ project: "${cfg.project_id}", kind: "evidence", text: "\u2026" }) opens any of them`, ...memories] : [] }
  ];
  return { text: fitBrief(PREAMBLE, sections, limit).text, findings };
}
function comparisonPointer(db, cfg) {
  const names = [...new Set(comparisonSections(db, cfg).map((s) => s.title.replace(/^Comparison: /, "").replace(/ by [^ ]+$/, "")))];
  return names.length ? [`kb_compare({ concept: "<name>" }) compares approaches by facet (${Object.keys(cfg.facets ?? {}).join(", ")}) for: ${names.join(", ")}`] : [];
}
function domainFindingsBrief(db, cfg, state, withPreamble, today = /* @__PURE__ */ new Date()) {
  const findings = rankFindings(db, cfg, TOP_FINDINGS, today).filter((f) => !state.briefed.includes(f.id));
  if (!findings.length) return null;
  state.briefed.push(...findings.map((f) => f.id));
  return fitBrief(withPreamble ? PREAMBLE : "", [{ title: `Relevant findings for ${cfg.domain}`, priority: 7, items: findings.map((f) => findingLine(f, cfg)) }]).text;
}
function buildRecallBrief(db, cfg, prompt, state, today = /* @__PURE__ */ new Date()) {
  const words = new Set(tokens(prompt));
  if (!words.size) return null;
  const aliases = db.sql.prepare("SELECT a.name_norm, a.concept_id, n.title FROM alias a JOIN note n ON n.id=a.concept_id AND n.deleted_at IS NULL").all();
  const hits = aliases.filter((a) => a.name_norm && a.name_norm.split("-").every((t) => words.has(t)));
  const prose = prompt.replace(/\S*[\\/]\S+/g, " ");
  const projects = db.sql.prepare("SELECT DISTINCT project FROM note WHERE kind='finding' AND project IS NOT NULL AND deleted_at IS NULL").all().map((r) => r.project).filter((p) => p !== cfg.project_id && new RegExp(`\\b${escapeRe(p)}\\b`, "i").test(prose));
  const byTitle = findingsByTitlePhrase(db, prompt, cfg.domain);
  const names = [.../* @__PURE__ */ new Set([...hits.map((h) => h.title), ...projects, ...byTitle.phrases.map((p) => `"${p}"`)])];
  if (!names.length) return null;
  const fresh = [.../* @__PURE__ */ new Set([...findingsAboutIn(db, [...new Set(hits.map((h) => h.concept_id))], cfg.domain), ...findingsIn(db, projects), ...byTitle.ids])].filter((id) => !state.briefed.includes(id));
  if (!fresh.length) return null;
  const all = rankCandidates(db, loadCandidates(db, fresh), cfg, today);
  const ranked = [...all.filter((r) => r.domain === cfg.domain), ...all.filter((r) => r.domain !== cfg.domain)].slice(0, RECALL_FINDINGS);
  state.briefed.push(...ranked.map((r) => r.id));
  return fitBrief(PREAMBLE, [{ title: `Knowledge bank on ${names.join(", ")}`, priority: 7, items: ranked.map((f) => findingLine(f, cfg)) }]).text;
}
var TOP_FINDINGS, RECALL_FINDINGS, MEMORY_TITLES, WRITE_ORIGINS, escapeRe;
var init_brief = __esm({
  "src/kb/brief.ts"() {
    "use strict";
    init_normalize();
    init_rank();
    init_compare();
    init_budget();
    init_atomic();
    init_paths();
    init_restore_brief();
    TOP_FINDINGS = 6;
    RECALL_FINDINGS = 5;
    MEMORY_TITLES = 40;
    WRITE_ORIGINS = ["commit", "path", "transcript", "url"];
    escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
});

// src/kb/auto-register.ts
import { existsSync as existsSync5, readdirSync, readFileSync as readFileSync5, writeFileSync as writeFileSync2 } from "node:fs";
import os2 from "node:os";
import path9 from "node:path";
function loadLexicon(db) {
  const domains = installedDomains(db);
  if (!domains.length) return DEFAULT_LEXICON;
  const lex = {};
  for (const d of domains) {
    const k = templateFor(db, d)?.keywords ?? [];
    lex[d] = k.length ? k : DEFAULT_LEXICON[d] ?? [];
  }
  return lex;
}
function scoreDomains(text, lex = DEFAULT_LEXICON) {
  const tokens2 = tokensOf(text), score = {};
  for (const [domain, words] of Object.entries(lex)) {
    const set = new Set(words);
    let n = 0;
    const seen = {};
    for (const t of tokens2) if (set.has(t) && (seen[t] = (seen[t] ?? 0) + 1) <= 3) n++;
    score[domain] = n;
  }
  return score;
}
function domainFromText(text, minScore, margin = 1, lex = DEFAULT_LEXICON) {
  const ranked = Object.entries(scoreDomains(text, lex)).sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  if (!top) return null;
  const need = top[0] === "tooling" ? minScore + 1 : minScore;
  if (top[1] < need || top[1] - (second?.[1] ?? 0) < margin) return null;
  const words = [...new Set(tokensOf(text).filter((t) => lex[top[0]].includes(t)))].slice(0, 4);
  return { domain: top[0], score: top[1], reason: words.join(", ") };
}
function listing(dir) {
  const out2 = [];
  const walk = (d, rel, depth) => {
    let entries = [];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out2.length >= 400) return;
      const r = rel ? `${rel}/${e.name}` : e.name;
      out2.push(e.isDirectory() ? `${r}/` : r);
      if (e.isDirectory() && depth < 2 && !SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(path9.join(d, e.name), r, depth + 1);
    }
  };
  walk(dir, "", 1);
  return out2;
}
function inferDomain(cwd, lex = DEFAULT_LEXICON) {
  const files = listing(cwd), names = files.map((f) => f.toLowerCase()), has = (re) => names.some((n) => re.test(n));
  const pkg = read(path9.join(cwd, "package.json")), cargo = read(path9.join(cwd, "Cargo.toml")), py = read(path9.join(cwd, "pyproject.toml")) + read(path9.join(cwd, "requirements.txt"));
  if (has(/\.xcodeproj\/$|\.xcworkspace\/$|^package\.swift$|^pubspec\.yaml$|\.swift$/)) return { domain: "ios", confidence: "high", reason: "Swift, Xcode or Flutter files" };
  if (/"@gen\//.test(pkg) || /\bgenie\b|\bgen-sdk\b/.test(cargo) || has(/^gen\.toml$|^genie\.toml$/)) return { domain: "gen-l1", confidence: "high", reason: "Gen SDK or genie crate" };
  if (has(/^anchor\.toml$|^programs\/$|^surfpool\.yaml$|^txtx\.yml$/) || /@solana\/|@coral-xyz\/anchor|@metaplex|@raydium|@jup-ag|@pinocchio/.test(pkg) || /solana-program|anchor-lang|pinocchio|spl-token/.test(cargo)) return { domain: "solana", confidence: "high", reason: "Solana program or SDK dependencies" };
  if (has(/^backtests?\/$|^strategies\/$|^signals\/$|^backtest\.py$/) || /databento|ib_insync|ibapi|alpaca|thetadata|ccxt|backtrader|vectorbt|yfinance|polygon|quantstats|zipline|schwab|tastytrade|tradingview/.test(py + pkg)) return { domain: "trading", confidence: "high", reason: "market-data or broker dependencies" };
  const byName = domainFromText(path9.basename(cwd).replace(/[-_.]+/g, " "), 1, 1, lex);
  if (byName) return { domain: byName.domain, confidence: "low", reason: `folder name suggests ${byName.domain} (${byName.reason})` };
  return { domain: "tooling", confidence: "low", reason: files.length ? "no chain, mobile or market signals" : "empty folder" };
}
function findConfig(cwd) {
  let dir = path9.resolve(cwd), file = "";
  for (let i = 0; i < 8; i++) {
    const f = path9.join(dir, ".kb.json");
    if (existsSync5(f)) {
      file = f;
      break;
    }
    const up = path9.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  if (!file) return null;
  try {
    return { file, cfg: JSON.parse(readFileSync5(file, "utf8")) };
  } catch {
    return null;
  }
}
function settleFromPrompt(cwd, prompt, lex = DEFAULT_LEXICON) {
  const found = findConfig(cwd);
  if (!found) return null;
  const { file, cfg } = found;
  if (!cfg.auto || cfg.auto.confidence !== "low" || !cfg.domain) return null;
  const guess = domainFromText(prompt, 3, 2, lex);
  if (!guess) return null;
  const previous = cfg.domain;
  if (guess.domain === previous) {
    if (cfg.auto.confidence === "low") {
      cfg.auto = { ...cfg.auto, confidence: "medium", reason: `confirmed by a prompt (${guess.reason})` };
      writeFileSync2(file, JSON.stringify(cfg, null, 2) + "\n");
    }
    return null;
  }
  cfg.domain = guess.domain;
  cfg.auto = { ...cfg.auto, confidence: "medium", reason: `a prompt mentions ${guess.reason}` };
  writeFileSync2(file, JSON.stringify(cfg, null, 2) + "\n");
  log("info", "domain settled from prompt", { file, previous, domain: guess.domain, reason: guess.reason });
  return { file, project_id: String(cfg.project_id ?? ""), domain: guess.domain, previous, reason: guess.reason };
}
function needsDecision(cwd, prompt, lex = DEFAULT_LEXICON) {
  const found = findConfig(cwd);
  if (!found) return null;
  const { file, cfg } = found;
  if (!cfg.auto || cfg.auto.confidence !== "low" || !cfg.domain || cfg.auto.decided) return null;
  if (tokensOf(prompt).length < MIN_DECISION_WORDS) return null;
  cfg.auto = { ...cfg.auto, decided: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) };
  writeFileSync2(file, JSON.stringify(cfg, null, 2) + "\n");
  log("info", "domain decision asked", { file, domain: cfg.domain });
  return { file, project_id: String(cfg.project_id ?? ""), domain: cfg.domain, known: knownDomains(lex) };
}
function looksLikeProject(cwd) {
  let entries = [];
  try {
    entries = readdirSync(cwd);
  } catch {
    return false;
  }
  const repos = entries.filter((e) => existsSync5(path9.join(cwd, e, ".git"))).length;
  if (repos >= 2) return false;
  return existsSync5(path9.join(cwd, ".git")) || MANIFESTS.some((m) => existsSync5(path9.join(cwd, m))) || entries.some((e) => e.endsWith(".xcodeproj")) || entries.length <= 8;
}
function autoRegister(cwd, home = os2.homedir(), lex = DEFAULT_LEXICON) {
  if (!cwd) return null;
  const dir = canonical(cwd);
  if (!existsSync5(dir)) return null;
  const rel = path9.relative(canonical(home), dir);
  if (!rel || rel === ".." || rel.startsWith(".." + path9.sep) || path9.isAbsolute(rel)) return null;
  if (rel.split(path9.sep).some((s) => s.startsWith(".") || SKIP_DIRS.has(s))) return null;
  if (WORKSPACE_ROOTS.includes(rel)) return null;
  if (kbJsonAbove(dir)) return null;
  if (!looksLikeProject(dir)) return null;
  const { domain, confidence, reason } = inferDomain(dir, lex);
  const project_id = path9.basename(dir).toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const file = path9.join(dir, ".kb.json");
  writeFileSync2(file, JSON.stringify({ project_id, domain, auto: { registered: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), confidence, reason } }, null, 2) + "\n");
  log("info", "auto-registered project", { file, domain, confidence, reason });
  return { file, project_id, domain, confidence, reason };
}
var DEFAULT_LEXICON, knownDomains, tokensOf, WORKSPACE_ROOTS, SKIP_DIRS, MANIFESTS, read, settledLine, MIN_DECISION_WORDS, decisionLine, kbJsonAbove, autoLine;
var init_auto_register = __esm({
  "src/kb/auto-register.ts"() {
    "use strict";
    init_templates();
    init_log();
    init_paths();
    DEFAULT_LEXICON = {
      trading: ["trade", "trading", "trader", "momentum", "crypto", "options", "0dte", "backtest", "backtests", "backtesting", "quant", "strategy", "strategies", "perp", "perps", "futures", "alpha", "signal", "signals", "sniper", "arb", "arbitrage", "orderbook", "portfolio", "sharpe", "drawdown", "broker", "exchange", "binance", "bybit", "hyperliquid", "coinbase", "spy", "spx", "btc", "eth", "ohlc", "candles", "pnl", "leaps", "iron", "condor", "straddle"],
      solana: ["solana", "sol", "anchor", "spl", "nft", "nfts", "mint", "minter", "candy", "token", "tokens", "pump", "raydium", "jupiter", "dex", "amm", "stake", "staking", "airdrop", "wallet", "program", "programs", "pda", "lamports", "devnet", "metaplex", "pinocchio", "surfpool"],
      "gen-l1": ["gen", "genie", "gen-l1", "clob", "genibook", "geniswap", "activation", "activations", "gvm"],
      ios: ["ios", "swift", "swiftui", "iphone", "ipad", "macos", "xcode", "testflight", "watchos", "flutter", "appstore"],
      tooling: ["cli", "tool", "tools", "plugin", "plugins", "agent", "agents", "mcp", "script", "scripts", "memory", "docs", "site", "website", "server", "api", "pipeline", "hook", "hooks", "extension", "dashboard", "scraper", "skill", "skills"]
    };
    knownDomains = (lex = DEFAULT_LEXICON) => Object.keys(lex).sort((a, b) => a === "tooling" ? 1 : b === "tooling" ? -1 : a.localeCompare(b));
    tokensOf = (text) => text.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
    WORKSPACE_ROOTS = ["projects", "Desktop", "Documents", "Downloads", "src", "code", "work", "github"];
    SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "target", "dist", "build", ".next", "vendor", "Pods", "AppData", "Library"]);
    MANIFESTS = ["package.json", "Cargo.toml", "pyproject.toml", "requirements.txt", "go.mod", "Package.swift", "pubspec.yaml", "Anchor.toml"];
    read = (p) => {
      try {
        return readFileSync5(p, "utf8");
      } catch {
        return "";
      }
    };
    settledLine = (s) => `Project domain changed from \`${s.previous}\` to \`${s.domain}\` because this prompt mentions ${s.reason}; the brief below is for ${s.domain}. Say "this is a <domain> project" to override.`;
    MIN_DECISION_WORDS = 12;
    decisionLine = (d) => `This folder was filed under \`${d.domain}\` by a guess (low confidence) and this prompt did not settle it. Decide now from the prompt alone, and do not ask the user unless the work is plainly a new kind of project. (1) Ordinary software \u2014 scripts, sites, services, libraries, tools, docs \u2014 is \`tooling\`: leave it and say nothing. (2) If it is one of ${d.known.filter((k) => k !== "tooling").join(", ")}, run \`${paths.kbCli()} project init --domain <d>\` here and say so; your next prompt's brief then carries that domain's findings, or call kb_brief({ project: "${d.project_id}" }) for them now. (3) Only if none of those describes the work (a console game, hardware, a research paper\u2026), propose a domain to the user with one AskUserQuestion \u2014 a short lowercase name, 4\u20136 facets (the axes an approach varies on; single snake_case words), 4\u20136 gates (the stages evidence passes through, weakest first) and 5\u201310 single-word keywords a prompt about such work contains \u2014 and on a yes run from this folder: ${paths.kbCli()} domain new <name> --facets a,b,c --gates g1,g2,g3 --keywords w1,w2,w3 --environment <where it runs> --subject <what it acts on>. It writes the template into the bank, installs it and files this folder under it.`;
    kbJsonAbove = (dir) => {
      let d = dir;
      for (let i = 0; i < 8; i++) {
        if (existsSync5(path9.join(d, ".kb.json"))) return true;
        const up = path9.dirname(d);
        if (up === d) break;
        d = up;
      }
      return false;
    };
    autoLine = (a, known = knownDomains()) => `This folder was registered in the knowledge bank automatically: project \`${a.project_id}\`, domain \`${a.domain}\` (${a.confidence} confidence: ${a.reason}).${a.confidence === "low" ? ` If the work turns out to be ${known.filter((d) => d !== a.domain).join(", ")}, run \`${paths.kbCli()} project init --domain <d>\` here and say so; the first prompt usually settles it on its own.` : ""} The file is \`.kb.json\`; commit it when you commit.`;
  }
});

// src/hooks/session-start.ts
var session_start_exports = {};
__export(session_start_exports, {
  buildStartupBrief: () => buildStartupBrief,
  handler: () => handler,
  sessionStart: () => sessionStart
});
import path10 from "node:path";
function lexicon() {
  try {
    const db = openDb();
    try {
      return loadLexicon(db);
    } finally {
      db.sql.close();
    }
  } catch (e) {
    log("warn", "bank unavailable; built-in domain lexicon", String(e));
    return DEFAULT_LEXICON;
  }
}
function buildStartupBrief(cwd, sessionId = "unknown", auto = null, lex = DEFAULT_LEXICON) {
  const cfg = loadProjectConfig(cwd);
  const text = startupText(cwd, sessionId, cfg);
  return auto ? `${autoLine(auto, knownDomains(lex))}

${text}` : text;
}
function startupText(cwd, sessionId, cfg) {
  if (cfg) {
    try {
      const state = loadState(sessionId), db = openDb();
      try {
        const { text, findings } = projectBrief(db, cfg, state.briefed.includes(QUESTIONS_SHOWN) ? [] : pendingQuestions(db, 3));
        state.briefed = [.../* @__PURE__ */ new Set([...state.briefed, QUESTIONS_SHOWN, ...findings.filter((f) => text.includes(`[${f.id}]`)).map((f) => f.id)])];
        state.domainBriefed = cfg.auto?.confidence !== "low" ? cfg.domain : "";
        saveState(sessionId, state);
        return text;
      } finally {
        db.sql.close();
      }
    } catch (e) {
      log("warn", "bank brief failed; phase-1 brief only", String(e));
    }
  }
  const hint = cfg ? "The knowledge bank did not answer (see hooks.log)." : `No .kb.json here; ${paths.kbCli()} project init --domain <d> registers this repo.`;
  const card = `Project memory active for ${path10.basename(cwd) || "this project"}. Large tool outputs are offloaded; recall(id) reopens them exactly. ${hint}`;
  return fitBrief(PREAMBLE, [...lastSessionSection(paths.projectKey(cwd)), { title: "Project", priority: 9, items: [card] }]).text;
}
async function sessionStart(input) {
  if (input.agent_id) return void 0;
  const source = String(input.source ?? ""), sessionId = String(input.session_id ?? "unknown");
  if (source === "startup" || source === "clear") {
    const cwd = String(input.cwd ?? "");
    let auto = null;
    const lex = lexicon();
    try {
      auto = autoRegister(cwd, void 0, lex);
    } catch (e) {
      log("warn", "auto-register failed", String(e));
    }
    return out(buildStartupBrief(cwd, sessionId, auto, lex));
  }
  if (source !== "compact") return void 0;
  const ts = loadTaskState(sessionId, String(input.transcript_path ?? ""));
  if (ts) return out(buildRestoreBrief(ts, readJson(path10.join(paths.sessionDir(sessionId), "audit.json"))));
  return out(fitBrief("Context was compacted. No task-state record was found for this session.", [{ title: "Pointers", priority: 1, items: recallPointers(loadState(sessionId)) }]).text);
}
var out, QUESTIONS_SHOWN, handler;
var init_session_start = __esm({
  "src/hooks/session-start.ts"() {
    "use strict";
    init_paths();
    init_budget();
    init_atomic();
    init_log();
    init_session_state();
    init_task_state();
    init_restore_brief();
    init_db();
    init_project();
    init_brief();
    init_auto_register();
    out = (additionalContext) => ({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } });
    QUESTIONS_SHOWN = "concept-questions";
    handler = sessionStart;
  }
});

// src/offload/blobs.ts
import { createHash as createHash2 } from "node:crypto";
import { existsSync as existsSync6, readFileSync as readFileSync6, appendFileSync as appendFileSync2, readdirSync as readdirSync2, statSync as statSync2, unlinkSync as unlinkSync2 } from "node:fs";
import path11 from "node:path";
function storeBlob(text, meta) {
  const id = createHash2("sha256").update(text, "utf8").digest("hex");
  const file = path11.join(paths.blobsDir(), id);
  const created = !existsSync6(file);
  const lines = text.split("\n").length;
  if (created) {
    writeFileAtomic(file, text);
    const m = { id, tool: meta.tool, chars: text.length, lines, head: text.slice(0, 96).replace(/\s+/g, " "), sessionId: meta.sessionId, createdAt: (/* @__PURE__ */ new Date()).toISOString(), command: meta.command === void 0 ? void 0 : redactSensitive(meta.command).text.slice(0, 120) };
    appendFileSync2(path11.join(paths.blobsDir(), "index.jsonl"), JSON.stringify(m) + "\n", "utf8");
  }
  return { id, id16: id.slice(0, 16), created, chars: text.length, lines };
}
function gcBlobs(maxAgeDays = 14, maxBytes = 500 * 1024 * 1024) {
  const dir = paths.blobsDir();
  const now = Date.now();
  const gone = /* @__PURE__ */ new Set();
  const files = readdirSync2(dir).filter((f) => f.length === 64).map((f) => ({ f, st: statSync2(path11.join(dir, f)) }));
  const kept = files.filter(({ f, st }) => {
    if (now - st.mtimeMs <= maxAgeDays * 864e5) return true;
    unlinkSync2(path11.join(dir, f));
    gone.add(f);
    return false;
  });
  let total = kept.reduce((n, x) => n + x.st.size, 0);
  for (const { f, st } of kept.sort((a, b) => a.st.mtimeMs - b.st.mtimeMs)) {
    if (total <= maxBytes) break;
    unlinkSync2(path11.join(dir, f));
    total -= st.size;
    gone.add(f);
  }
  const index = path11.join(dir, "index.jsonl");
  if (gone.size && existsSync6(index)) writeFileAtomic(index, readFileSync6(index, "utf8").split("\n").filter((l) => l && !gone.has(/"id":"([0-9a-f]{64})"/.exec(l)?.[1] ?? "")).map((l) => l + "\n").join(""));
  return { removed: gone.size };
}
var init_blobs = __esm({
  "src/offload/blobs.ts"() {
    "use strict";
    init_paths();
    init_atomic();
    init_redaction();
  }
});

// src/lib/kb-sync.ts
import { existsSync as existsSync7 } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path12 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function kbJs() {
  const here = path12.dirname(fileURLToPath2(import.meta.url));
  return [path12.join(here, "kb.js"), path12.join(here, "..", "..", "dist", "kb.js")].find(existsSync7);
}
function bankDirty() {
  const bank = paths.bankDir();
  if (!existsSync7(path12.join(bank, ".git"))) return false;
  const r = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: bank, encoding: "utf8", timeout: 1e4, windowsHide: true });
  return r.status === 0 && r.stdout.trim().length > 0;
}
function spawnKbSync() {
  if (!existsSync7(path12.join(paths.bankDir(), ".git"))) return;
  const kb = kbJs();
  if (!kb) {
    log("warn", "kb sync not spawned: dist/kb.js not found");
    return;
  }
  spawn(process.execPath, [kb, "sync", "--quiet", "--wait"], { detached: true, stdio: "ignore", windowsHide: true }).on("error", (e) => log("error", "kb sync spawn failed", String(e))).unref();
}
var init_kb_sync = __esm({
  "src/lib/kb-sync.ts"() {
    "use strict";
    init_paths();
    init_log();
  }
});

// src/hooks/session-sync.ts
var session_sync_exports = {};
__export(session_sync_exports, {
  handler: () => handler2,
  sessionSync: () => sessionSync
});
async function sessionSync(_input) {
  spawnKbSync();
  log("info", "blob gc", gcBlobs());
  return void 0;
}
var handler2;
var init_session_sync = __esm({
  "src/hooks/session-sync.ts"() {
    "use strict";
    init_blobs();
    init_kb_sync();
    init_log();
    handler2 = sessionSync;
  }
});

// src/hooks/user-prompt.ts
var user_prompt_exports = {};
__export(user_prompt_exports, {
  handler: () => handler3,
  userPrompt: () => userPrompt
});
async function userPrompt(input) {
  const prompt = String(input.prompt ?? ""), cwd = String(input.cwd ?? "");
  if (!prompt.trim() || HARNESS_RE.test(prompt) || !loadProjectConfig(cwd)) return void 0;
  let db = null, lex = DEFAULT_LEXICON;
  try {
    db = openDb();
    lex = loadLexicon(db);
  } catch (e) {
    log("warn", "bank unavailable; built-in domain lexicon", String(e));
  }
  let head = "";
  if (!input.agent_id) {
    try {
      const s = settleFromPrompt(cwd, prompt, lex);
      if (s) head = settledLine(s);
      else {
        const d = needsDecision(cwd, prompt, lex);
        if (d) head = decisionLine(d);
      }
    } catch (e) {
      log("warn", "settle from prompt failed", String(e));
    }
  }
  const cfg = loadProjectConfig(cwd);
  if (!cfg) {
    db?.sql.close();
    return void 0;
  }
  const sessionId = String(input.session_id ?? "unknown"), agentId = input.agent_id ? String(input.agent_id) : "main";
  const state = loadState(sessionId, agentId);
  let text = null;
  try {
    if (!db) throw new Error("bank unavailable");
    text = buildRecallBrief(db, cfg, prompt, state);
    if (!input.agent_id && cfg.auto?.confidence !== "low" && state.domainBriefed !== void 0 && state.domainBriefed !== cfg.domain) {
      const extra = domainFindingsBrief(db, cfg, state, !text);
      state.domainBriefed = cfg.domain;
      if (extra) {
        text = text ? `${text}

${extra}` : extra;
        log("info", "domain findings briefed", { project: cfg.project_id, domain: cfg.domain });
      }
    }
    if (text) state.lastBrief = text;
    try {
      saveState(sessionId, state, agentId);
    } catch (e) {
      log("warn", "session state not saved", String(e));
    }
  } catch (e) {
    log("warn", "recall brief failed; injecting the cached brief", String(e));
    text = state.lastBrief ?? null;
  } finally {
    db?.sql.close();
  }
  text = `${head}

${text ?? ""}`.trim();
  return text ? { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: text } } : void 0;
}
var HARNESS_RE, handler3;
var init_user_prompt = __esm({
  "src/hooks/user-prompt.ts"() {
    "use strict";
    init_log();
    init_session_state();
    init_db();
    init_project();
    init_brief();
    init_auto_register();
    HARNESS_RE = /^\s*(?:<task-notification>|<command-name>|<local-command-stdout>|<local-command-caveat>|<system-reminder>|\[SYSTEM NOTIFICATION)/;
    handler3 = userPrompt;
  }
});

// src/offload/placeholder.ts
function buildPlaceholder(a) {
  const n = a.chars.toLocaleString("en-US");
  if (a.seen) return `[same output as earlier \xB7 id ${a.id16} \xB7 ${n} chars \xB7 recall(id="${a.id16}") for the exact text]`;
  const ls = a.text.split("\n");
  const head = ls.slice(0, a.headLines).join("\n");
  const tail = ls.slice(Math.max(a.headLines, ls.length - a.tailLines)).join("\n");
  return `${head}
\u2026[${Math.max(0, a.lines - a.headLines - a.tailLines)} lines offloaded \xB7 id ${a.id16} \xB7 recall(id="${a.id16}", offset=0) pages the full ${n} chars]\u2026
${tail}`;
}
var init_placeholder = __esm({
  "src/offload/placeholder.ts"() {
    "use strict";
  }
});

// src/offload/offload.ts
function largestStringField(obj) {
  const found = [];
  const walk = (v, p) => {
    if (typeof v === "string") found.push({ path: p, value: v });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...p, i]));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, [...p, k]);
  };
  walk(obj, []);
  found.sort((a, b) => b.value.length - a.value.length);
  if (!found.length) return null;
  if (found.length > 1 && found[0].value.length < 2 * found[1].value.length) return null;
  return found[0];
}
function setAtPath(obj, p, value) {
  if (!p.length) return value;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  clone[p[0]] = setAtPath(clone[p[0]], p.slice(1), value);
  return clone;
}
function offload(input) {
  const started = Date.now();
  const cfg = paths.config().offload ?? {};
  const threshold = cfg.thresholdChars ?? (input.tool_name === "Bash" ? 1e4 : 2e4), headLines = cfg.headLines ?? 30, tailLines = cfg.tailLines ?? 15;
  const sessionId = String(input.session_id ?? "unknown");
  const agentId = input.agent_id ? String(input.agent_id) : "main";
  const target = largestStringField(input.tool_response);
  if (!target || target.value.length < threshold) return void 0;
  const state = loadState(sessionId, agentId);
  const redacted = redactSensitive(target.value);
  if (redacted.text.startsWith("[REDACTED:oversize")) return void 0;
  if (buildPlaceholder({ text: redacted.text, chars: redacted.text.length, lines: redacted.text.split("\n").length, id16: "0".repeat(16), seen: false, headLines, tailLines }).length >= target.value.length) return void 0;
  const command = input.tool_input?.command;
  const blob = storeBlob(redacted.text, { tool: String(input.tool_name), sessionId, command: typeof command === "string" ? command : void 0 });
  const seen = state.seenBlobs.includes(blob.id);
  if (!seen) {
    state.seenBlobs = [...state.seenBlobs, blob.id].slice(-500);
    saveState(sessionId, state, agentId);
  }
  if (Date.now() - started > 2e3) {
    log("warn", "offload exceeded 2 s; leaving output untouched");
    return void 0;
  }
  const replacement = buildPlaceholder({ text: redacted.text, chars: blob.chars, lines: blob.lines, id16: blob.id16, seen, headLines, tailLines });
  return { hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: setAtPath(input.tool_response, target.path, replacement) } };
}
var init_offload = __esm({
  "src/offload/offload.ts"() {
    "use strict";
    init_paths();
    init_redaction();
    init_blobs();
    init_placeholder();
    init_session_state();
    init_log();
  }
});

// src/hooks/post-tool-use.ts
var post_tool_use_exports = {};
__export(post_tool_use_exports, {
  handler: () => handler4,
  postToolUse: () => postToolUse
});
async function postToolUse(input) {
  return offload(input);
}
var handler4;
var init_post_tool_use = __esm({
  "src/hooks/post-tool-use.ts"() {
    "use strict";
    init_offload();
    handler4 = postToolUse;
  }
});

// src/hooks/pre-compact.ts
var pre_compact_exports = {};
__export(pre_compact_exports, {
  handler: () => handler5,
  preCompact: () => preCompact
});
import { rmSync as rmSync2 } from "node:fs";
import path13 from "node:path";
async function preCompact(input) {
  if (input.agent_id) return void 0;
  const sessionId = String(input.session_id ?? "unknown");
  const tp = String(input.transcript_path ?? "");
  if (!tp) return void 0;
  const state = loadState(sessionId);
  const delta = readTranscript(tp, state.lastSnapshotOffset);
  const text = delta.entries.map((e) => JSON.stringify(e, redactJson)).join("\n");
  if (text) {
    const blob = storeBlob(text, { tool: "snapshot", sessionId });
    state.snapshots.push({ id: blob.id16, from: state.lastSnapshotOffset, to: delta.toOffset, at: (/* @__PURE__ */ new Date()).toISOString() });
    state.lastSnapshotOffset = delta.toOffset;
  }
  const ts = JSON.parse(JSON.stringify(extractTaskState(readTranscript(tp, 0).entries, recallPointers(state)), redactJson));
  const dir = paths.sessionDir(sessionId);
  rmSync2(path13.join(dir, "audit.json"), { force: true });
  writeFileAtomic(path13.join(dir, "task-state.md"), renderTaskState(ts));
  writeFileAtomic(path13.join(dir, "task-state.json"), JSON.stringify(ts) + "\n");
  saveState(sessionId, state);
  log("info", "pre-compact snapshot written", { sessionId, trigger: input.trigger, snapshots: state.snapshots.length });
  return void 0;
}
var handler5;
var init_pre_compact = __esm({
  "src/hooks/pre-compact.ts"() {
    "use strict";
    init_transcript();
    init_task_state();
    init_blobs();
    init_session_state();
    init_atomic();
    init_redaction();
    init_paths();
    init_log();
    handler5 = preCompact;
  }
});

// src/compaction/audit.ts
import path14 from "node:path";
function auditSummary(summary, ts) {
  const s = summary.toLowerCase();
  const present = [], missing = [];
  const check = (label, key) => {
    (key && s.includes(key.toLowerCase()) ? present : missing).push(label);
  };
  for (const f of ts.files) check(path14.basename(f.path), path14.basename(f.path));
  for (const c of ts.commands) check(c.cmd, c.cmd.split(/\s+/).slice(0, 2).join(" "));
  for (const o of ts.openItems) check(o, o.split(/\s+/).slice(0, 6).join(" "));
  for (const e of ts.errors) check(e, e.split(/\s+/).slice(0, 8).join(" "));
  for (const v of ts.exactValues) check(v, v);
  return { present, missing };
}
var init_audit = __esm({
  "src/compaction/audit.ts"() {
    "use strict";
  }
});

// src/hooks/post-compact.ts
var post_compact_exports = {};
__export(post_compact_exports, {
  handler: () => handler6,
  postCompact: () => postCompact
});
import path15 from "node:path";
async function postCompact(input) {
  if (input.agent_id) return void 0;
  const summary = String(input.compact_summary ?? "");
  if (!summary) return void 0;
  const sessionId = String(input.session_id ?? "unknown");
  const ts = loadTaskState(sessionId, String(input.transcript_path ?? ""));
  if (!ts) return void 0;
  const audit = auditSummary(summary, ts);
  writeFileAtomic(path15.join(paths.sessionDir(sessionId), "audit.json"), JSON.stringify({ ...audit, summary_chars: summary.length, at: (/* @__PURE__ */ new Date()).toISOString() }, null, 2) + "\n");
  log("info", "post-compact audit written", { sessionId, present: audit.present.length, missing: audit.missing.length });
  return void 0;
}
var handler6;
var init_post_compact = __esm({
  "src/hooks/post-compact.ts"() {
    "use strict";
    init_paths();
    init_atomic();
    init_log();
    init_task_state();
    init_audit();
    handler6 = postCompact;
  }
});

// src/hooks/subagent-start.ts
var subagent_start_exports = {};
__export(subagent_start_exports, {
  handler: () => handler7,
  subagentStart: () => subagentStart
});
import path16 from "node:path";
async function subagentStart(input) {
  const cwd = String(input.cwd ?? ""), cfg = loadProjectConfig(cwd), proj = cfg?.project_id ?? (path16.basename(cwd) || "this project");
  const lines = [`Project memory: project ${proj}${cfg ? `, domain ${cfg.domain}` : ""}. Offloaded tool outputs and pre-compaction snapshots reopen with recall(id). kb_brief({ project: "${proj}" }) returns the full brief; kb_find searches the bank at ${paths.bankDir()}. Keep your own context small: summarize what you read, do not paste large outputs back. (agent_type: ${String(input.agent_type ?? "unknown")})`];
  if (cfg) {
    let gates = [];
    try {
      const db = openDb();
      try {
        const top = rankFindings(db, cfg, SUBAGENT_FINDINGS);
        if (top.length) lines.push("Findings that apply here:", ...top.map((f) => `- ${findingLine(f, cfg)}`));
        gates = templateFor(db, cfg.domain)?.gates ?? [];
      } finally {
        db.sql.close();
      }
    } catch (e) {
      log("warn", "subagent brief: findings skipped", String(e));
    }
    const gate = gates.length ? `, gate: "<one of ${gates.join(" | ")}>"` : "";
    lines.push(`If you measure a number or learn why something failed, record it before you finish: kb_write({ kind: "finding", title: "<one claim with the number>", domain: "${cfg.domain}", project: "${proj}", tags: ["<2-3 concept words a future prompt would use>"], attrs: { state: "observed"${gate} }, metrics: [...], evidence: [{ kind: "path", ref: "<file>" }] }). One call per result; the orchestrator will not do it for you.`);
  }
  return { hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: charSafePrefix(lines.join("\n"), CAP) } };
}
var SUBAGENT_FINDINGS, CAP, handler7;
var init_subagent_start = __esm({
  "src/hooks/subagent-start.ts"() {
    "use strict";
    init_budget();
    init_paths();
    init_log();
    init_project();
    init_db();
    init_rank();
    init_brief();
    init_templates();
    SUBAGENT_FINDINGS = 5;
    CAP = 3e3;
    handler7 = subagentStart;
  }
});

// src/compaction/drafts.ts
import path17 from "node:path";
import { existsSync as existsSync8, readFileSync as readFileSync7 } from "node:fs";
function buildDrafts(cfg, ts, transcriptPath, today = /* @__PURE__ */ new Date()) {
  const day = today.toISOString().slice(0, 10);
  const files = ts.files.map((f) => f.path).filter((p) => existsSync8(p)).slice(-3);
  const evidence = [...transcriptPath && existsSync8(transcriptPath) ? [{ kind: "transcript", ref: transcriptPath }] : [], ...files.map((ref) => ({ kind: "path", ref }))];
  const seen = /* @__PURE__ */ new Set();
  const records = [];
  for (const line of ts.exactValues) {
    const title = line.replace(/\*\*/g, "").replace(/[.;:,]+$/, "").trim();
    if (title.length < 24 || !isClaim(title)) continue;
    const k = norm(title);
    if (seen.has(k)) continue;
    seen.add(k);
    records.push({ kind: "finding", title: shortTitle(title), body: `## Claim
${title}

## Evidence
Drafted by optimus from the session transcript on ${day}; the numbers are as the session stated them, not re-measured. Edit the title into a claim, add a gate, or delete this record before running kb write.`, attrs: { state: "observed", valid_from: day }, evidence });
    if (records.length >= MAX_DRAFTS) break;
  }
  return { defaults: { domain: cfg.domain, project: cfg.project_id }, records };
}
function writeDrafts(projectKey, spec) {
  const file = draftsFile(projectKey), prev = readDrafts(file);
  const seen = /* @__PURE__ */ new Set();
  const pending = [], written = [];
  for (const r of [...prev.filter((p) => p.written), ...spec.records, ...prev.filter((p) => !p.written)]) {
    const k = norm(r.title);
    if (seen.has(k)) continue;
    seen.add(k);
    if (r.written) {
      if (written.length < MAX_WRITTEN) written.push(r);
    } else if (pending.length < MAX_FILE) pending.push(r);
  }
  if (!pending.length && !written.length) return void 0;
  writeFileAtomic(file, JSON.stringify({ ...spec, records: [...pending, ...written] }, null, 2) + "\n");
  return pending.length ? { file, count: pending.length } : void 0;
}
var MAX_DRAFTS, norm, MEASURE_RE, NARRATION_RE, isClaim, shortTitle, draftsFile, MAX_FILE, MAX_WRITTEN, readDrafts, draftKey, existingDraftKeys;
var init_drafts = __esm({
  "src/compaction/drafts.ts"() {
    "use strict";
    init_paths();
    init_atomic();
    MAX_DRAFTS = 8;
    norm = (s) => s.toLowerCase().replace(/[^a-z0-9%$.]+/g, " ").trim().slice(0, 100);
    MEASURE_RE = /%|\$\d|[+−-]\d+\.\d+|\b\d+(?:\.\d+)?\s?(?:x|times|fold|ms|s|K|M|GB|MB|KB|tokens|bps|fills|trades|days|years|bars|tests|passes|failures|errors|warnings|files|lines|rows|runs|samples|requests)\b|\b[a-z]+_(?:ms|us|ns|s|secs?|bytes|kb|mb|gb|pct|bps|count)\b:?\s*\d|\b(?:a year|per year|sharpe|drawdown|win rate|pnl|p50|p90|p99|latency|throughput|hit rate|accuracy|error rate|correlation|compute units|cu)\b/i;
    NARRATION_RE = /\b(?:I'll|I'm|I've|I'd|we'll|we're|let me|let's|pushed|committed|watcher|re-armed|next:|now|verifying|checking|looks (?:right|good|fine|correct)|one (?:\w+ )?(?:problem|issue)|you(?:r|'d|'re|'ll|'ve)?|today|yesterday|tomorrow|tonight|this (?:week|month|morning|afternoon)|on (?:mon|tues|wednes|thurs|fri|satur|sun)day|meanwhile|loading|waiting|in the background|(?:is|are|still) running)\b|^(?:I|we|say|still|then|next)\b|\?/i;
    isClaim = (line) => MEASURE_RE.test(line) && !NARRATION_RE.test(line);
    shortTitle = (s) => s.length <= 120 ? s : s.slice(0, 120).replace(/\s+\S*$/, "") + "\u2026";
    draftsFile = (projectKey) => path17.join(paths.projectDir(projectKey), "draft-findings.json");
    MAX_FILE = 20;
    MAX_WRITTEN = 40;
    readDrafts = (file) => {
      try {
        return existsSync8(file) ? JSON.parse(readFileSync7(file, "utf8")).records ?? [] : [];
      } catch {
        return [];
      }
    };
    draftKey = norm;
    existingDraftKeys = (projectKey) => new Set(readDrafts(draftsFile(projectKey)).map((r) => norm(r.title)));
  }
});

// src/hooks/subagent-stop.ts
var subagent_stop_exports = {};
__export(subagent_stop_exports, {
  handler: () => handler8,
  subagentStop: () => subagentStop
});
import { existsSync as existsSync9 } from "node:fs";
async function subagentStop(input) {
  const cwd = String(input.cwd ?? ""), tp = String(input.agent_transcript_path ?? "");
  const cfg = loadProjectConfig(cwd);
  if (!cfg || !tp || !existsSync9(tp)) return void 0;
  try {
    const ts = extractTaskState(readTranscript(tp, 0).entries, []);
    const w = writeDrafts(paths.projectKey(cwd), buildDrafts(cfg, ts, tp));
    if (w) log("info", "subagent drafts merged", { agent: String(input.agent_id ?? ""), count: w.count });
  } catch (e) {
    log("warn", "subagent drafts failed", String(e));
  }
  return void 0;
}
var handler8;
var init_subagent_stop = __esm({
  "src/hooks/subagent-stop.ts"() {
    "use strict";
    init_paths();
    init_transcript();
    init_log();
    init_project();
    init_task_state();
    init_drafts();
    handler8 = subagentStop;
  }
});

// src/hooks/stop.ts
var stop_exports = {};
__export(stop_exports, {
  handler: () => handler9,
  stop: () => stop
});
import path18 from "node:path";
import { appendFileSync as appendFileSync3, existsSync as existsSync10 } from "node:fs";
function lastPromptIndex(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.type !== "user" || e.isMeta) continue;
    const c = e.message?.content;
    const text = typeof c === "string" ? c : Array.isArray(c) ? c.filter((x) => x?.type === "text").map((x) => String(x.text ?? "")).join("\n") : "";
    if (text.trim() && !/^\s*[<[]/.test(text)) return i;
  }
  return 0;
}
function withLastMessage(entries, last) {
  if (typeof last !== "string" || !last.trim() || hasLast(entries, last)) return entries;
  return [...entries, { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: last }] } }];
}
async function entriesWithLastMessage(tp, last) {
  let entries = readTranscript(tp, 0).entries;
  if (typeof last === "string" && last.trim()) for (let i = 0; i < 5 && !hasLast(entries, last); i++) {
    await new Promise((r) => setTimeout(r, 200));
    entries = readTranscript(tp, 0).entries;
  }
  return withLastMessage(entries, last);
}
async function stop(input) {
  if (input.agent_id) return void 0;
  const sessionId = String(input.session_id ?? "unknown");
  const cwd = String(input.cwd ?? "");
  const tp = String(input.transcript_path ?? "");
  const at = (/* @__PURE__ */ new Date()).toISOString();
  const entries = tp && existsSync10(tp) ? await entriesWithLastMessage(tp, input.last_assistant_message) : [];
  let cfg = null, ask = [], wrote = false;
  if (entries.length) {
    const taskState = JSON.parse(JSON.stringify(extractTaskState(entries, recallPointers(loadState(sessionId))), redactJson));
    cfg = loadProjectConfig(cwd);
    const turn = entries.slice(lastPromptIndex(entries));
    wrote = wroteFindings(turn);
    let drafts;
    if (cfg) {
      const key = paths.projectKey(cwd);
      const turnState = JSON.parse(JSON.stringify(extractTaskState(turn, []), redactJson));
      const spec = buildDrafts(cfg, turnState, tp), known = existingDraftKeys(key);
      const fresh = spec.records.filter((r) => !known.has(draftKey(r.title)));
      drafts = writeDrafts(key, spec);
      if (fresh.length && !input.stop_hook_active && !wrote) ask = fresh.slice(0, MAX_ASK);
      log("info", "stop: turn judged", { project: cfg.project_id, candidates: fresh.length, asked: ask.length > 0, wrote, continued: !!input.stop_hook_active });
    }
    const last = { at, sessionId, cwd, taskState, ...drafts ? { drafts } : {} };
    writeFileAtomic(path18.join(paths.projectDir(paths.projectKey(cwd)), "last-session.json"), JSON.stringify(last) + "\n");
  }
  const u = [...entries].reverse().find((e) => e.type === "assistant" && e.message?.usage)?.message?.usage ?? {};
  appendFileSync3(path18.join(paths.stateDir(), "metrics.jsonl"), JSON.stringify({ at, session: sessionId, input: u.input_tokens ?? null, cache_read: u.cache_read_input_tokens ?? null, cache_create: u.cache_creation_input_tokens ?? null }) + "\n");
  const stale = Date.now() - (Date.parse(paths.config().lastSyncAt ?? "") || 0) > 6e4;
  if (wrote || stale || bankDirty()) spawnKbSync();
  if (cfg && ask.length) {
    log("info", "stop: asked the session to record", { project: cfg.project_id, candidates: ask.length });
    return { decision: "block", reason: askText(cfg, ask) };
  }
  return void 0;
}
var MAX_ASK, hasLast, wroteFindings, askText, handler9;
var init_stop = __esm({
  "src/hooks/stop.ts"() {
    "use strict";
    init_paths();
    init_atomic();
    init_redaction();
    init_transcript();
    init_session_state();
    init_kb_sync();
    init_log();
    init_task_state();
    init_drafts();
    init_project();
    MAX_ASK = 8;
    hasLast = (entries, last) => {
      const prev = [...entries].reverse().find((e) => e.type === "assistant" && textOf(e));
      return !!prev && textOf(prev) === last.trim();
    };
    wroteFindings = (turn) => turn.some((e) => e.type === "assistant" && Array.isArray(e.message?.content) && e.message.content.some((b) => b?.type === "tool_use" && /kb_write$/.test(String(b.name ?? ""))));
    askText = (cfg, ask) => [
      `Optimus: before finishing, record what this turn established. For each candidate below that is a durable, reusable result (a measurement, the cause of a failure, a limit that was hit), call kb_write({ kind: "finding", title: "<one claim with the number>", domain: "${cfg.domain}", project: "${cfg.project_id}", tags: ["<2-3 concept words a future prompt would use>"], attrs: { state: "observed" }, evidence: [{ kind: "path", ref: "<file>" }] }). Skip narration, definitions, dated prices and advice. Then finish; this request is not repeated for these statements.`,
      ...ask.map((r) => `- ${r.title}`)
    ].join("\n");
    handler9 = stop;
  }
});

// src/hooks/session-end.ts
var session_end_exports = {};
__export(session_end_exports, {
  handler: () => handler10,
  sessionEnd: () => sessionEnd
});
import path19 from "node:path";
import { existsSync as existsSync11, readFileSync as readFileSync8 } from "node:fs";
async function sessionEnd(input) {
  if (input.agent_id) return void 0;
  const sessionId = String(input.session_id ?? "unknown");
  const ts = path19.join(paths.sessionDir(sessionId), "task-state.md");
  if (existsSync11(ts)) storeBlob(readFileSync8(ts, "utf8"), { tool: "task-state", sessionId });
  deleteSession(sessionId);
  return void 0;
}
var handler10;
var init_session_end = __esm({
  "src/hooks/session-end.ts"() {
    "use strict";
    init_paths();
    init_blobs();
    init_session_state();
    handler10 = sessionEnd;
  }
});

// src/lib/stdin.ts
function readStdin(idleMs = 1500) {
  return new Promise((resolve) => {
    const chunks = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      let s = Buffer.concat(chunks).toString("utf8");
      if (s.charCodeAt(0) === 65279) s = s.slice(1);
      resolve(s);
    };
    let timer = setTimeout(finish, idleMs);
    process.stdin.on("data", (c) => {
      chunks.push(c);
      clearTimeout(timer);
      timer = setTimeout(finish, idleMs);
    });
    process.stdin.on("end", finish);
    process.stdin.on("error", finish);
    process.stdin.resume();
  });
}

// src/lib/run-hook.ts
init_log();
async function runHook(event2, fn) {
  process.on("uncaughtException", (e) => {
    log("error", `uncaught in ${event2}`, String(e));
    process.exit(0);
  });
  process.on("unhandledRejection", (e) => {
    log("error", `unhandled in ${event2}`, String(e));
    process.exit(0);
  });
  let input = {};
  const raw = await readStdin();
  if (raw.trim()) {
    try {
      input = JSON.parse(raw);
    } catch (e) {
      log("error", `stdin parse failed for ${event2}`, { chars: raw.length, error: e instanceof Error ? e.name : "parse error" });
      process.exit(0);
    }
  }
  try {
    const out2 = await fn(input);
    if (out2 !== void 0) {
      process.stdout.write(JSON.stringify(out2), () => process.exit(0));
      return;
    }
  } catch (e) {
    log("error", `handler threw in ${event2}`, String(e));
  }
  process.exit(0);
}

// src/hooks/entry.ts
var event = process.argv[2] ?? "";
var modules = {
  "session-start": () => Promise.resolve().then(() => (init_session_start(), session_start_exports)),
  "session-sync": () => Promise.resolve().then(() => (init_session_sync(), session_sync_exports)),
  "user-prompt": () => Promise.resolve().then(() => (init_user_prompt(), user_prompt_exports)),
  "post-tool-use": () => Promise.resolve().then(() => (init_post_tool_use(), post_tool_use_exports)),
  "pre-compact": () => Promise.resolve().then(() => (init_pre_compact(), pre_compact_exports)),
  "post-compact": () => Promise.resolve().then(() => (init_post_compact(), post_compact_exports)),
  "subagent-start": () => Promise.resolve().then(() => (init_subagent_start(), subagent_start_exports)),
  "subagent-stop": () => Promise.resolve().then(() => (init_subagent_stop(), subagent_stop_exports)),
  "stop": () => Promise.resolve().then(() => (init_stop(), stop_exports)),
  "session-end": () => Promise.resolve().then(() => (init_session_end(), session_end_exports))
};
await runHook(event, async (input) => {
  const load = modules[event];
  if (!load) return void 0;
  return (await load()).handler(input);
});
