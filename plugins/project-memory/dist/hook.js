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
function readTranscript(path11, fromOffset = 0) {
  const fd = openSync(path11, "r");
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
function extractTaskState(entries, pointers) {
  const users = entries.filter((e) => e.type === "user" && textOf(e));
  const assistants = entries.filter((e) => e.type === "assistant");
  const constraints = [], decisions = [], files = /* @__PURE__ */ new Map(), commands = [], tests = [], errors = [], values = [];
  let openItems = [];
  for (const u of users) for (const line of textOf(u).split("\n")) if (/\b(must|never|always|only|don't|do not)\b/i.test(line)) constraints.push(cap(line.trim(), 200));
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
    goalFirst: cap(users[0] ? textOf(users[0]) : "", 600),
    goalLatest: cap(users.at(-1) ? textOf(users.at(-1)) : "", 600),
    constraints: uniq(constraints).slice(0, 12),
    decisions: uniq(decisions).slice(0, 12),
    files: [...files.entries()].map(([path11, v]) => ({ path: path11, ...v })).slice(-40),
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

// src/hooks/session-start.ts
var session_start_exports = {};
__export(session_start_exports, {
  buildStartupBrief: () => buildStartupBrief,
  handler: () => handler,
  sessionStart: () => sessionStart
});
import path6 from "node:path";
function buildStartupBrief(cwd) {
  const sections = [];
  const last = readJson(path6.join(paths.projectDir(paths.projectKey(cwd)), "last-session.json"));
  if (last) {
    const t = last.taskState;
    sections.push({ title: "Last session in this project", priority: 10, items: [
      `When: ${last.at} (session ${last.sessionId}, in ${last.cwd})`,
      `Goal: ${t.goalFirst}`,
      `Latest: ${t.goalLatest}`,
      ...t.openItems.map((o) => `Open: ${o}`),
      ...t.decisions,
      ...t.files.map((f) => `${f.path} (${f.action})`),
      ...t.pointers
    ] });
  }
  sections.push({ title: "Project", priority: 9, items: [`Project memory active for ${path6.basename(cwd) || "this project"}. Large tool outputs are offloaded; recall(id) reopens them exactly. Knowledge-bank briefs arrive in phase 2.`] });
  return fitBrief(PREAMBLE, sections).text;
}
async function sessionStart(input) {
  if (input.agent_id) return void 0;
  const source = String(input.source ?? "");
  if (source === "startup" || source === "clear") return out(buildStartupBrief(String(input.cwd ?? "")));
  if (source !== "compact") return void 0;
  const sessionId = String(input.session_id ?? "unknown");
  const ts = loadTaskState(sessionId, String(input.transcript_path ?? ""));
  if (ts) return out(buildRestoreBrief(ts, readJson(path6.join(paths.sessionDir(sessionId), "audit.json"))));
  return out(fitBrief("Context was compacted. No task-state record was found for this session.", [{ title: "Pointers", priority: 1, items: recallPointers(loadState(sessionId)) }]).text);
}
var out, handler;
var init_session_start = __esm({
  "src/hooks/session-start.ts"() {
    "use strict";
    init_paths();
    init_budget();
    init_atomic();
    init_session_state();
    init_task_state();
    init_restore_brief();
    out = (additionalContext) => ({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext } });
    handler = sessionStart;
  }
});

// src/hooks/session-sync.ts
var session_sync_exports = {};
__export(session_sync_exports, {
  handler: () => handler2,
  sessionSync: () => sessionSync
});
async function sessionSync(_input) {
  return void 0;
}
var handler2;
var init_session_sync = __esm({
  "src/hooks/session-sync.ts"() {
    "use strict";
    handler2 = sessionSync;
  }
});

// src/hooks/user-prompt.ts
var user_prompt_exports = {};
__export(user_prompt_exports, {
  handler: () => handler3,
  userPrompt: () => userPrompt
});
async function userPrompt(_input) {
  return void 0;
}
var handler3;
var init_user_prompt = __esm({
  "src/hooks/user-prompt.ts"() {
    "use strict";
    handler3 = userPrompt;
  }
});

// src/offload/blobs.ts
import { createHash as createHash2 } from "node:crypto";
import { existsSync as existsSync4, readFileSync as readFileSync4, appendFileSync as appendFileSync2, readdirSync, statSync as statSync2, unlinkSync as unlinkSync2 } from "node:fs";
import path7 from "node:path";
function storeBlob(text, meta) {
  const id = createHash2("sha256").update(text, "utf8").digest("hex");
  const file = path7.join(paths.blobsDir(), id);
  const created = !existsSync4(file);
  const lines = text.split("\n").length;
  if (created) {
    writeFileAtomic(file, text);
    const m = { id, tool: meta.tool, chars: text.length, lines, head: text.slice(0, 96).replace(/\s+/g, " "), sessionId: meta.sessionId, createdAt: (/* @__PURE__ */ new Date()).toISOString(), command: meta.command === void 0 ? void 0 : redactSensitive(meta.command).text.slice(0, 120) };
    appendFileSync2(path7.join(paths.blobsDir(), "index.jsonl"), JSON.stringify(m) + "\n", "utf8");
  }
  return { id, id16: id.slice(0, 16), created, chars: text.length, lines };
}
var init_blobs = __esm({
  "src/offload/blobs.ts"() {
    "use strict";
    init_paths();
    init_atomic();
    init_redaction();
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
import path8 from "node:path";
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
  rmSync2(path8.join(dir, "audit.json"), { force: true });
  writeFileAtomic(path8.join(dir, "task-state.md"), renderTaskState(ts));
  writeFileAtomic(path8.join(dir, "task-state.json"), JSON.stringify(ts) + "\n");
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
import path9 from "node:path";
function auditSummary(summary, ts) {
  const s = summary.toLowerCase();
  const present = [], missing = [];
  const check = (label, key) => {
    (key && s.includes(key.toLowerCase()) ? present : missing).push(label);
  };
  for (const f of ts.files) check(path9.basename(f.path), path9.basename(f.path));
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
import path10 from "node:path";
async function postCompact(input) {
  if (input.agent_id) return void 0;
  const summary = String(input.compact_summary ?? "");
  if (!summary) return void 0;
  const sessionId = String(input.session_id ?? "unknown");
  const ts = loadTaskState(sessionId, String(input.transcript_path ?? ""));
  if (!ts) return void 0;
  const audit = auditSummary(summary, ts);
  writeFileAtomic(path10.join(paths.sessionDir(sessionId), "audit.json"), JSON.stringify({ ...audit, summary_chars: summary.length, at: (/* @__PURE__ */ new Date()).toISOString() }, null, 2) + "\n");
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
async function subagentStart(_input) {
  return void 0;
}
var handler7;
var init_subagent_start = __esm({
  "src/hooks/subagent-start.ts"() {
    "use strict";
    handler7 = subagentStart;
  }
});

// src/hooks/stop.ts
var stop_exports = {};
__export(stop_exports, {
  handler: () => handler8,
  stop: () => stop
});
async function stop(_input) {
  return void 0;
}
var handler8;
var init_stop = __esm({
  "src/hooks/stop.ts"() {
    "use strict";
    handler8 = stop;
  }
});

// src/hooks/session-end.ts
var session_end_exports = {};
__export(session_end_exports, {
  handler: () => handler9,
  sessionEnd: () => sessionEnd
});
async function sessionEnd(_input) {
  return void 0;
}
var handler9;
var init_session_end = __esm({
  "src/hooks/session-end.ts"() {
    "use strict";
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
    const timer = setTimeout(() => {
      if (chunks.length === 0) finish();
    }, idleMs);
    process.stdin.on("data", (c) => chunks.push(c));
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
    if (out2 !== void 0) process.stdout.write(JSON.stringify(out2));
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
