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

// src/hooks/post-tool-use.ts
var post_tool_use_exports = {};
__export(post_tool_use_exports, {
  handler: () => handler4,
  postToolUse: () => postToolUse
});
async function postToolUse(_input) {
  return void 0;
}
var handler4;
var init_post_tool_use = __esm({
  "src/hooks/post-tool-use.ts"() {
    "use strict";
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

// src/lib/log.ts
import { appendFileSync } from "node:fs";
import path2 from "node:path";

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

// src/lib/log.ts
function log(level, msg, data) {
  try {
    appendFileSync(path2.join(paths.logsDir(), "hooks.log"), JSON.stringify({ t: (/* @__PURE__ */ new Date()).toISOString(), level, msg, data }) + "\n", "utf8");
  } catch {
  }
}

// src/lib/run-hook.ts
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
      log("error", `stdin parse failed for ${event2}`, { head: raw.slice(0, 200), error: String(e) });
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
