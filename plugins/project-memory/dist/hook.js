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

// src/hooks/session-start.ts
var session_start_exports = {};
__export(session_start_exports, {
  handler: () => handler,
  sessionStart: () => sessionStart
});
async function sessionStart(_input) {
  return void 0;
}
var handler;
var init_session_start = __esm({
  "src/hooks/session-start.ts"() {
    "use strict";
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
var PATTERNS, MAX_CHARS;
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
  }
});

// src/lib/atomic.ts
import { writeFileSync as writeFileSync2, renameSync as renameSync2, realpathSync, existsSync as existsSync2, statSync, chmodSync, unlinkSync } from "node:fs";
import path3 from "node:path";
import { randomBytes } from "node:crypto";
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

// src/offload/blobs.ts
import { createHash as createHash2 } from "node:crypto";
import { existsSync as existsSync3, readFileSync as readFileSync2, appendFileSync as appendFileSync2, readdirSync, statSync as statSync2, unlinkSync as unlinkSync2 } from "node:fs";
import path4 from "node:path";
function storeBlob(text, meta) {
  const id = createHash2("sha256").update(text, "utf8").digest("hex");
  const file = path4.join(paths.blobsDir(), id);
  const created = !existsSync3(file);
  const lines = text.split("\n").length;
  if (created) {
    writeFileAtomic(file, text);
    const m = { id, tool: meta.tool, chars: text.length, lines, head: text.slice(0, 96).replace(/\s+/g, " "), sessionId: meta.sessionId, createdAt: (/* @__PURE__ */ new Date()).toISOString(), command: meta.command === void 0 ? void 0 : redactSensitive(meta.command).text.slice(0, 120) };
    appendFileSync2(path4.join(paths.blobsDir(), "index.jsonl"), JSON.stringify(m) + "\n", "utf8");
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

// src/lib/session-state.ts
import { readFileSync as readFileSync3, rmSync } from "node:fs";
import path5 from "node:path";
function loadState(sessionId, agentId = "main") {
  try {
    return { ...empty(), ...JSON.parse(readFileSync3(path5.join(paths.sessionDir(sessionId, agentId), "state.json"), "utf8")) };
  } catch {
    return empty();
  }
}
function saveState(sessionId, s, agentId = "main") {
  writeFileAtomic(path5.join(paths.sessionDir(sessionId, agentId), "state.json"), JSON.stringify(s, null, 2) + "\n");
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
async function preCompact(_input) {
  return void 0;
}
var handler5;
var init_pre_compact = __esm({
  "src/hooks/pre-compact.ts"() {
    "use strict";
    handler5 = preCompact;
  }
});

// src/hooks/post-compact.ts
var post_compact_exports = {};
__export(post_compact_exports, {
  handler: () => handler6,
  postCompact: () => postCompact
});
async function postCompact(_input) {
  return void 0;
}
var handler6;
var init_post_compact = __esm({
  "src/hooks/post-compact.ts"() {
    "use strict";
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
    const out = await fn(input);
    if (out !== void 0) process.stdout.write(JSON.stringify(out));
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
