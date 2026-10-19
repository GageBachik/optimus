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

// src/lib/paths.ts
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
function ensure(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
  return p;
}
var safe, paths;
var init_paths = __esm({
  "src/lib/paths.ts"() {
    "use strict";
    safe = (s) => s.replace(/[^A-Za-z0-9_-]/g, "_");
    paths = {
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
          const c = JSON.parse(readFileSync(this.configPath(), "utf8"));
          return c && typeof c === "object" && !Array.isArray(c) ? c : {};
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
              if (typeof id === "string" && id) return id;
            } catch {
            }
          }
          const up = path.dirname(dir);
          if (up === dir) break;
          dir = up;
        }
        return createHash("sha256").update(path.resolve(cwd)).digest("hex").slice(0, 16);
      },
      projectDir(key) {
        return ensure(path.join(this.stateDir(), "projects", safe(key)));
      }
    };
  }
});

// src/lib/log.ts
import { appendFileSync } from "node:fs";
import path2 from "node:path";
function log(level, msg, data) {
  try {
    appendFileSync(path2.join(paths.logsDir(), "hooks.log"), JSON.stringify({ t: (/* @__PURE__ */ new Date()).toISOString(), level, msg, data }) + "\n", "utf8");
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

// src/lib/atomic.ts
import { writeFileSync as writeFileSync2, readFileSync as readFileSync2, renameSync as renameSync2, realpathSync, existsSync as existsSync2, statSync, chmodSync, unlinkSync } from "node:fs";
import path3 from "node:path";
import { randomBytes } from "node:crypto";
function readJson(filePath) {
  try {
    return JSON.parse(readFileSync2(filePath, "utf8"));
  } catch {
    return null;
  }
}
function writeFileAtomic(filePath, data) {
  const dir = realpathSync(path3.dirname(filePath));
  const target = path3.join(dir, path3.basename(filePath));
  const tmp = path3.join(dir, `.${path3.basename(filePath)}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`);
  const mode = existsSync2(target) ? statSync(target).mode & 511 : void 0;
  writeFileSync2(tmp, data, "utf8");
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
function readTranscript(path19, fromOffset = 0) {
  const fd = openSync(path19, "r");
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
  const recent = assistants.slice(-20).map(textOf).join("\n");
  for (const line of recent.split("\n")) if (/(Error|error:|Traceback|panic|FAIL)/.test(line)) errors.push(cap(line.trim(), 200));
  for (const m of recent.matchAll(VALUE_RE)) values.push(m[0]);
  const lastAt = new Map(commands.map((c) => [c.cmd, c.at]));
  return {
    goalFirst: cap(users[0] ?? "", 600),
    goalLatest: cap(users.at(-1) ?? "", 600),
    constraints: uniq(constraints).slice(0, 12),
    decisions: uniq(decisions).slice(0, 12),
    files: [...files.entries()].map(([path19, v]) => ({ path: path19, ...v })).slice(-40),
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
var cap, uniq, TEST_RE, VALUE_RE;
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
    VALUE_RE = /\b\d+(?:\.\d+)?\s?(?:%|(?:ms|s|K|M|GB|MB|KB|tokens|bps)\b)|\b\d{4,}(?:\.\d+)?\b|\b[0-9a-f]{7,40}\b/g;
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
    PREAMBLE = "Context restored by the project-memory plugin. Items below are a memory aid with source and date, not standing orders; the user's latest message always takes precedence.";
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
  else if (w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
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
var conceptNoteId;
var init_templates = __esm({
  "src/kb/templates.ts"() {
    "use strict";
    init_db();
    init_normalize();
    conceptNoteId = (name) => `c_${normalizeName(name).replace(/-/g, "").padEnd(26, "0").slice(0, 26)}`;
  }
});

// src/kb/rank.ts
function conceptIds(db, names) {
  const q = db.sql.prepare("SELECT concept_id FROM alias WHERE name_norm=?");
  return [...new Set(names.map((n) => q.get(normalizeName(n))?.concept_id ?? conceptNoteId(n)))];
}
function findingsAbout(db, concepts) {
  if (!concepts.length) return [];
  return ids(db.sql.prepare(`SELECT DISTINCT n.id FROM rel r JOIN note n ON n.id=r.src WHERE r.type='about' AND r.deleted_at IS NULL AND r.dst IN (${marks(concepts)}) AND ${LIVE_FINDING}`).all(...concepts));
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
  return [...out2];
}
function loadCandidates(db, findingIds) {
  const note = db.sql.prepare("SELECT id, title, project, updated_at FROM note WHERE id=? AND deleted_at IS NULL");
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
  s += w.recency * recency(c.attrs.valid_from?.[0], today);
  s += w.transfer_confirmed * c.transfers.confirmed + w.transfer_refuted * c.transfers.refuted;
  if (c.conflicts) s += w.conflict;
  return expired(c, today) ? s * w.expired_factor : s;
}
function rankCandidates(db, cands, cfg, today = /* @__PURE__ */ new Date()) {
  const w = loadWeights(db);
  return cands.map((c) => ({ ...c, score: scoreFinding(c, cfg, w, today), demoted: expired(c, today) })).sort((a, b) => b.score - a.score || cmp(b.updated_at, a.updated_at) || cmp(a.id, b.id));
}
var NOT_SUPERSEDED, LIVE_FINDING, marks, ids, cmp, expired, candidateFindings, rankFindings;
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
    expired = (c, today) => {
      const to = c.attrs.valid_to?.[0];
      return !!to && Date.parse(to) < today.getTime();
    };
    candidateFindings = (db, cfg) => loadCandidates(db, candidateIds(db, cfg));
    rankFindings = (db, cfg, limit, today = /* @__PURE__ */ new Date()) => rankCandidates(db, candidateFindings(db, cfg), cfg, today).slice(0, limit);
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
  return rows.map((r) => `Merge "${r.at}" into "${r.bt}"? kb concepts accept ${r.id} | reject ${r.id}`);
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
  for (const p of f.proposals) if (p.project === cfg.project_id) out2.push(`transfer ${p.state}: kb transfer ${p.id} confirm|refute`);
  return out2;
}
function findingLine(f, cfg) {
  const a = f.attrs;
  const meta = [a.state?.[0] ?? "unverified", a.gate?.[0] && `gate ${a.gate[0]}`, a.valid_from?.[0] ?? f.updated_at.slice(0, 10), f.project && `project ${f.project}`, f.demoted && `expired ${a.valid_to?.[0]}`].filter(Boolean).join(", ");
  const notes = cfg ? fitNotes(f, cfg) : [];
  return `${f.title} (${meta}) [${f.id}] evidence: ${f.evidence.join("; ") || "none"}${notes.length ? ` \u2014 ${notes.join("; ")}` : ""}`;
}
function projectCard(cfg) {
  const t = cfg.target, facets = Object.entries(cfg.facets ?? {}).map(([k, v]) => `${k}=${v}`);
  const parts = [`Domain ${cfg.domain}`, t?.environment || t?.subject ? `target ${t.environment ?? "?"} \xD7 ${t.subject ?? "?"}` : "", facets.length ? `facets ${facets.join(", ")}` : "", cfg.relies_on?.length ? `relies on ${cfg.relies_on.join(", ")}` : ""];
  return { title: `Project ${cfg.project_id}`, priority: 9, items: [`${parts.filter(Boolean).join("; ")}. Large tool outputs are offloaded; recall(id) reopens them exactly. kb_brief({ project: "${cfg.project_id}" }) re-reads this brief; kb_find searches the bank.`] };
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
    ...comparisonSections(db, cfg),
    { title: "Imported memories for this project", priority: 1, items: memories.length ? [`kb_find({ project: "${cfg.project_id}", kind: "evidence", text: "\u2026" }) opens any of them`, ...memories] : [] }
  ];
  return { text: fitBrief(PREAMBLE, sections, limit).text, findings };
}
function buildRecallBrief(db, cfg, prompt, state, today = /* @__PURE__ */ new Date()) {
  const words = new Set(tokens(prompt));
  if (!words.size) return null;
  const aliases = db.sql.prepare("SELECT a.name_norm, a.concept_id, n.title FROM alias a JOIN note n ON n.id=a.concept_id AND n.deleted_at IS NULL").all();
  const hits = aliases.filter((a) => a.name_norm && a.name_norm.split("-").every((t) => words.has(t)));
  const projects = db.sql.prepare("SELECT DISTINCT project FROM note WHERE project IS NOT NULL AND deleted_at IS NULL").all().map((r) => r.project).filter((p) => new RegExp(`\\b${escapeRe(p)}\\b`, "i").test(prompt));
  const names = [.../* @__PURE__ */ new Set([...hits.map((h) => h.title), ...projects])];
  if (!names.length) return null;
  const fresh = [.../* @__PURE__ */ new Set([...findingsAbout(db, [...new Set(hits.map((h) => h.concept_id))]), ...findingsIn(db, projects)])].filter((id) => !state.briefed.includes(id));
  if (!fresh.length) return null;
  const ranked = rankCandidates(db, loadCandidates(db, fresh), cfg, today).slice(0, TOP_FINDINGS);
  state.briefed.push(...ranked.map((r) => r.id));
  return fitBrief(PREAMBLE, [{ title: `Knowledge bank on ${names.join(", ")}`, priority: 7, items: ranked.map((f) => findingLine(f, cfg)) }]).text;
}
var TOP_FINDINGS, MEMORY_TITLES, WRITE_ORIGINS, escapeRe;
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
    TOP_FINDINGS = 20;
    MEMORY_TITLES = 40;
    WRITE_ORIGINS = ["commit", "path", "transcript", "url"];
    escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
});

// src/kb/auto-register.ts
import { existsSync as existsSync5, readdirSync, readFileSync as readFileSync5, writeFileSync as writeFileSync3 } from "node:fs";
import os2 from "node:os";
import path9 from "node:path";
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
function inferDomain(cwd) {
  const files = listing(cwd), names = files.map((f) => f.toLowerCase()), has = (re) => names.some((n) => re.test(n));
  const pkg = read(path9.join(cwd, "package.json")), cargo = read(path9.join(cwd, "Cargo.toml")), py = read(path9.join(cwd, "pyproject.toml")) + read(path9.join(cwd, "requirements.txt"));
  if (has(/\.xcodeproj\/$|\.xcworkspace\/$|^package\.swift$|^pubspec\.yaml$|\.swift$/)) return { domain: "ios", confidence: "high", reason: "Swift, Xcode or Flutter files" };
  if (/"@gen\//.test(pkg) || /\bgenie\b|\bgen-sdk\b/.test(cargo) || has(/^gen\.toml$|^genie\.toml$/)) return { domain: "gen-l1", confidence: "high", reason: "Gen SDK or genie crate" };
  if (has(/^anchor\.toml$|^programs\/$|^surfpool\.yaml$|^txtx\.yml$/) || /@solana\/|@coral-xyz\/anchor|@metaplex|@raydium|@jup-ag|@pinocchio/.test(pkg) || /solana-program|anchor-lang|pinocchio|spl-token/.test(cargo)) return { domain: "solana", confidence: "high", reason: "Solana program or SDK dependencies" };
  if (has(/^backtests?\/$|^strategies\/$|^signals\/$|^backtest\.py$/) || /databento|ib_insync|ibapi|alpaca|thetadata|ccxt|backtrader|vectorbt|yfinance|polygon|quantstats|zipline|schwab|tastytrade|tradingview/.test(py + pkg)) return { domain: "trading", confidence: "high", reason: "market-data or broker dependencies" };
  return { domain: "tooling", confidence: "low", reason: files.length ? "no chain, mobile or market signals" : "empty folder" };
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
function autoRegister(cwd, home = os2.homedir()) {
  if (!cwd) return null;
  const dir = path9.resolve(cwd);
  if (!existsSync5(dir) || !dir.startsWith(home + path9.sep)) return null;
  const rel = path9.relative(home, dir);
  if (rel.split(path9.sep).some((s) => s.startsWith(".") || SKIP_DIRS.has(s))) return null;
  if (["projects", "Desktop", "Documents", "Downloads", "src", "code", "work", "github"].includes(rel)) return null;
  if (loadProjectConfig(dir)) return null;
  if (!looksLikeProject(dir)) return null;
  const { domain, confidence, reason } = inferDomain(dir);
  const project_id = path9.basename(dir).toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const file = path9.join(dir, ".kb.json");
  writeFileSync3(file, JSON.stringify({ project_id, domain, auto: { registered: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), confidence, reason } }, null, 2) + "\n");
  log("info", "auto-registered project", { file, domain, confidence, reason });
  return { file, project_id, domain, confidence, reason };
}
var SKIP_DIRS, MANIFESTS, read, autoLine;
var init_auto_register = __esm({
  "src/kb/auto-register.ts"() {
    "use strict";
    init_project();
    init_log();
    SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "target", "dist", "build", ".next", "vendor", "Pods"]);
    MANIFESTS = ["package.json", "Cargo.toml", "pyproject.toml", "requirements.txt", "go.mod", "Package.swift", "pubspec.yaml", "Anchor.toml"];
    read = (p) => {
      try {
        return readFileSync5(p, "utf8");
      } catch {
        return "";
      }
    };
    autoLine = (a) => `This folder was registered in the knowledge bank automatically: project \`${a.project_id}\`, domain \`${a.domain}\` (${a.confidence} confidence: ${a.reason}).${a.confidence === "low" ? " If the work turns out to be trading, solana, gen-l1 or ios, run `kb project init --domain <d>` here and say so." : ""} The file is \`.kb.json\`; commit it when you commit.`;
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
function buildStartupBrief(cwd, sessionId = "unknown", auto = null) {
  const cfg = loadProjectConfig(cwd);
  const text = startupText(cwd, sessionId, cfg);
  return auto ? `${autoLine(auto)}

${text}` : text;
}
function startupText(cwd, sessionId, cfg) {
  if (cfg) {
    try {
      const state = loadState(sessionId), db = openDb();
      try {
        const { text, findings } = projectBrief(db, cfg, state.briefed.includes(QUESTIONS_SHOWN) ? [] : pendingQuestions(db, 3));
        state.briefed = [.../* @__PURE__ */ new Set([...state.briefed, QUESTIONS_SHOWN, ...findings.filter((f) => text.includes(`[${f.id}]`)).map((f) => f.id)])];
        saveState(sessionId, state);
        return text;
      } finally {
        db.sql.close();
      }
    } catch (e) {
      log("warn", "bank brief failed; phase-1 brief only", String(e));
    }
  }
  const hint = cfg ? "The knowledge bank did not answer (see hooks.log)." : "No .kb.json here; kb project init --domain <d> adds this repo to the knowledge bank.";
  const card = `Project memory active for ${path10.basename(cwd) || "this project"}. Large tool outputs are offloaded; recall(id) reopens them exactly. ${hint}`;
  return fitBrief(PREAMBLE, [...lastSessionSection(paths.projectKey(cwd)), { title: "Project", priority: 9, items: [card] }]).text;
}
async function sessionStart(input) {
  if (input.agent_id) return void 0;
  const source = String(input.source ?? ""), sessionId = String(input.session_id ?? "unknown");
  if (source === "startup" || source === "clear") {
    const cwd = String(input.cwd ?? "");
    let auto = null;
    try {
      auto = autoRegister(cwd);
    } catch (e) {
      log("warn", "auto-register failed", String(e));
    }
    return out(buildStartupBrief(cwd, sessionId, auto));
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
import { spawn } from "node:child_process";
import path12 from "node:path";
import { fileURLToPath } from "node:url";
function kbJs() {
  const here = path12.dirname(fileURLToPath(import.meta.url));
  return [path12.join(here, "kb.js"), path12.join(here, "..", "..", "dist", "kb.js")].find(existsSync7);
}
function spawnKbSync() {
  if (!existsSync7(path12.join(paths.bankDir(), ".git"))) return;
  const kb = kbJs();
  if (!kb) {
    log("warn", "kb sync not spawned: dist/kb.js not found");
    return;
  }
  spawn(process.execPath, [kb, "sync", "--quiet"], { detached: true, stdio: "ignore", windowsHide: true }).on("error", (e) => log("error", "kb sync spawn failed", String(e))).unref();
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
  const prompt = String(input.prompt ?? ""), cfg = prompt.trim() ? loadProjectConfig(String(input.cwd ?? "")) : null;
  if (!cfg) return void 0;
  const sessionId = String(input.session_id ?? "unknown"), agentId = input.agent_id ? String(input.agent_id) : "main";
  const state = loadState(sessionId, agentId);
  let text = null;
  try {
    const db = openDb();
    try {
      text = buildRecallBrief(db, cfg, prompt, state);
    } finally {
      db.sql.close();
    }
    if (text) {
      state.lastBrief = text;
      saveState(sessionId, state, agentId);
    }
  } catch (e) {
    log("warn", "recall brief failed; injecting the cached brief", String(e));
    text = state.lastBrief ?? null;
  }
  return text ? { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: text } } : void 0;
}
var handler3;
var init_user_prompt = __esm({
  "src/hooks/user-prompt.ts"() {
    "use strict";
    init_log();
    init_session_state();
    init_db();
    init_project();
    init_brief();
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
  const threshold = cfg.thresholdChars ?? 2e4, headLines = cfg.headLines ?? 30, tailLines = cfg.tailLines ?? 15;
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
  const cwd = String(input.cwd ?? ""), proj = loadProjectConfig(cwd)?.project_id ?? (path16.basename(cwd) || "this project");
  const text = `Project memory: project ${proj}. Offloaded tool outputs and pre-compaction snapshots reopen with recall(id). Knowledge bank at ${paths.bankDir()}: kb_brief({ project: "${proj}" }) returns the ranked findings brief for this project; kb_find searches it. Keep your own context small: summarize what you read, do not paste large outputs back. (agent_type: ${String(input.agent_type ?? "unknown")})`;
  return { hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: charSafePrefix(text, 1500) } };
}
var handler7;
var init_subagent_start = __esm({
  "src/hooks/subagent-start.ts"() {
    "use strict";
    init_budget();
    init_paths();
    init_project();
    handler7 = subagentStart;
  }
});

// src/hooks/stop.ts
var stop_exports = {};
__export(stop_exports, {
  handler: () => handler8,
  stop: () => stop
});
import path17 from "node:path";
import { appendFileSync as appendFileSync3, existsSync as existsSync8 } from "node:fs";
async function stop(input) {
  if (input.agent_id) return void 0;
  const sessionId = String(input.session_id ?? "unknown");
  const cwd = String(input.cwd ?? "");
  const tp = String(input.transcript_path ?? "");
  const at = (/* @__PURE__ */ new Date()).toISOString();
  const entries = tp && existsSync8(tp) ? readTranscript(tp, 0).entries : [];
  if (entries.length) {
    const taskState = JSON.parse(JSON.stringify(extractTaskState(entries, recallPointers(loadState(sessionId))), redactJson));
    const last = { at, sessionId, cwd, taskState };
    writeFileAtomic(path17.join(paths.projectDir(paths.projectKey(cwd)), "last-session.json"), JSON.stringify(last) + "\n");
  }
  const u = [...entries].reverse().find((e) => e.type === "assistant" && e.message?.usage)?.message?.usage ?? {};
  appendFileSync3(path17.join(paths.stateDir(), "metrics.jsonl"), JSON.stringify({ at, session: sessionId, input: u.input_tokens ?? null, cache_read: u.cache_read_input_tokens ?? null, cache_create: u.cache_creation_input_tokens ?? null }) + "\n");
  if (Date.now() - (Date.parse(paths.config().lastSyncAt ?? "") || 0) > 6e4) spawnKbSync();
  return void 0;
}
var handler8;
var init_stop = __esm({
  "src/hooks/stop.ts"() {
    "use strict";
    init_paths();
    init_atomic();
    init_redaction();
    init_transcript();
    init_session_state();
    init_kb_sync();
    init_task_state();
    handler8 = stop;
  }
});

// src/hooks/session-end.ts
var session_end_exports = {};
__export(session_end_exports, {
  handler: () => handler9,
  sessionEnd: () => sessionEnd
});
import path18 from "node:path";
import { existsSync as existsSync9, readFileSync as readFileSync7 } from "node:fs";
async function sessionEnd(input) {
  if (input.agent_id) return void 0;
  const sessionId = String(input.session_id ?? "unknown");
  const ts = path18.join(paths.sessionDir(sessionId), "task-state.md");
  if (existsSync9(ts)) storeBlob(readFileSync7(ts, "utf8"), { tool: "task-state", sessionId });
  deleteSession(sessionId);
  return void 0;
}
var handler9;
var init_session_end = __esm({
  "src/hooks/session-end.ts"() {
    "use strict";
    init_paths();
    init_blobs();
    init_session_state();
    handler9 = sessionEnd;
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
  "stop": () => Promise.resolve().then(() => (init_stop(), stop_exports)),
  "session-end": () => Promise.resolve().then(() => (init_session_end(), session_end_exports))
};
await runHook(event, async (input) => {
  const load = modules[event];
  if (!load) return void 0;
  return (await load()).handler(input);
});
