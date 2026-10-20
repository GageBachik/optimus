#!/usr/bin/env node
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = Symbol.for("yaml.alias");
    var DOC = Symbol.for("yaml.document");
    var MAP = Symbol.for("yaml.map");
    var PAIR = Symbol.for("yaml.pair");
    var SCALAR = Symbol.for("yaml.scalar");
    var SEQ = Symbol.for("yaml.seq");
    var NODE_TYPE = Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar;
    exports.isSeq = isSeq;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path18) {
      const ctrl = callVisitor(key, node, visitor, path18);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path18, ctrl);
        return visit_(key, ctrl, visitor, path18);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path18 = Object.freeze(path18.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path18);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path18 = Object.freeze(path18.concat(node));
          const ck = visit_("key", node.key, visitor, path18);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path18);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path18) {
      const ctrl = await callVisitor(key, node, visitor, path18);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path18, ctrl);
        return visitAsync_(key, ctrl, visitor, path18);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path18 = Object.freeze(path18.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path18);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path18 = Object.freeze(path18.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path18);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path18);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path18) {
      if (typeof visitor === "function")
        return visitor(key, node, path18);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path18);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path18);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path18);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path18);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path18);
      return void 0;
    }
    function replaceNode(key, path18, node) {
      const parent = path18[path18.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value2, arg, ctx) {
      if (Array.isArray(value2))
        return value2.map((v, i) => toJS(v, String(i), ctx));
      if (value2 && typeof value2.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value2))
          return value2.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value2, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value2.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value2 === "bigint" && !ctx?.keep)
        return Number(value2);
      return value2;
    }
    exports.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        if (found && ctx) {
          const { anchors: anchors2, doc: doc2, maxAliasCount } = ctx;
          let data = anchors2.get(found);
          if (!data) {
            toJS.toJS(found, null, ctx);
            data = anchors2.get(found);
          }
          if (data?.res === void 0) {
            const msg = "This should not happen: Alias anchor was not resolved?";
            throw new ReferenceError(msg);
          }
          if (maxAliasCount >= 0) {
            data.count += 1;
            if (data.aliasCount === 0)
              data.aliasCount = getAliasCount(doc2, found, anchors2);
            if (data.count * data.aliasCount > maxAliasCount) {
              const msg = "Excessive alias count indicates a resource exhaustion attack";
              throw new ReferenceError(msg);
            }
          }
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const source = this.resolve(ctx.doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        return ctx.anchors.get(source).res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value2) => !value2 || typeof value2 !== "function" && typeof value2 !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value2) {
        super(identity.SCALAR);
        this.value = value2;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value2, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value2) && !t.format);
    }
    function createNode(value2, tagName, ctx) {
      if (identity.isDocument(value2))
        value2 = value2.contents;
      if (identity.isNode(value2))
        return value2;
      if (identity.isPair(value2)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value2);
        return map;
      }
      if (value2 instanceof String || value2 instanceof Number || value2 instanceof Boolean || typeof BigInt !== "undefined" && value2 instanceof BigInt) {
        value2 = value2.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value2 && typeof value2 === "object") {
        ref = sourceObjects.get(value2);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value2));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value2, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value2, tagName, schema.tags);
      if (!tagObj) {
        if (value2 && typeof value2.toJSON === "function") {
          value2 = value2.toJSON();
        }
        if (!value2 || typeof value2 !== "object") {
          const node2 = new Scalar.Scalar(value2);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value2 instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value2) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value2, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value2, ctx) : new Scalar.Scalar(value2);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path18, value2) {
      let v = value2;
      for (let i = path18.length - 1; i >= 0; --i) {
        const k = path18[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path18) => path18 == null || typeof path18 === "object" && !!path18[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path18, value2) {
        if (isEmptyPath(path18))
          this.add(value2);
        else {
          const [key, ...rest] = path18;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value2);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value2));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path18) {
        const [key, ...rest] = path18;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path18, keepScalar) {
        const [key, ...rest] = path18;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path18) {
        const [key, ...rest] = path18;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path18, value2) {
        const [key, ...rest] = path18;
        if (rest.length === 0) {
          this.set(key, value2);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value2);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value2));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value2, ctx) {
      const json = JSON.stringify(value2);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value2) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value2, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value2.includes("\n") || /[ \t]\n|\n[ \t]/.test(value2))
        return doubleQuotedString(value2, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value2) ? "  " : "");
      const res = "'" + value2.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value2, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value2.includes('"');
        const hasSingle = value2.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value2, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value: value2 }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value2)) {
        return quotedString(value2, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value2) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value2, lineWidth, indent.length);
      if (!value2)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value2.length; endStart > 0; --endStart) {
        const ch = value2[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value2.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value2 === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value2 = value2.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value2.length; ++startEnd) {
        const ch = value2[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value2.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value2 = value2.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value2.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value2 = value2.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value2}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value: value2 } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value2.includes("\n") || inFlow && /[[\]{},]/.test(value2)) {
        return quotedString(value2, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value2)) {
        return implicitKey || inFlow || !value2.includes("\n") ? quotedString(value2, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value2.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value2)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value2, ctx);
        }
      }
      const str = value2.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value2, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify2(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify2;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value: value2 }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value2 == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify2.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value2 == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value2 == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value2)) {
        vsb = !!value2.spaceBefore;
        vcb = value2.commentBefore;
        valueComment = value2.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value2 && typeof value2 === "object")
          value2 = doc.createNode(value2);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value2))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value2) && !value2.flow && !value2.tag && !value2.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify2.stringify(value2, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value2)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value2.flow ?? value2.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value2) => value2 === MERGE_KEY || typeof value2 === "symbol" && value2.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value2) {
      const source = resolveAliasValue(ctx, value2);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value2) {
      const source = resolveAliasValue(ctx, value2);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value3] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value3);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value3,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value2) {
      return ctx && identity.isAlias(value2) ? value2.resolve(ctx.doc, ctx) : value2;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log3 = require_log();
    var merge = require_merge();
    var stringify2 = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value: value2 }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value2);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value2);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value2, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value2, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify2.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log3.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value2, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value2, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value2 = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value2;
      }
      clone(schema) {
        let { key, value: value2 } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value2))
          value2 = value2.clone(schema);
        return new _Pair(key, value2);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify3 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify3(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items: items2 }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items2.length; ++i) {
        const item = items2[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify2.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items: items2 }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items2.length; ++i) {
        const item = items2[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify2.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items2.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items2, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items2) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value2) => {
          if (typeof replacer === "function")
            value2 = replacer.call(obj, key, value2);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value2 !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value2, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value2] of obj)
            add(key, value2);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value2) {
        this.add(new Pair.Pair(key, value2), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value2) {
        this.items.push(value2);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value2) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value2))
          prev.value = value2;
        else
          this.items[idx] = value2;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value2) => typeof value2 === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value2) => value2 == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value2) => typeof value2 === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value: value2 }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value2 === sv)
            return source;
        }
        return value2 ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value: value2 }) {
      if (typeof value2 === "bigint")
        return String(value2);
      const num = typeof value2 === "number" ? value2 : Number(value2);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value2, -0) ? "-0" : JSON.stringify(value2);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value2) => typeof value2 === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value2) => typeof value2 === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value2) => typeof value2 === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value2) => typeof value2 === "bigint" || Number.isInteger(value2);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value: value2 } = node;
      if (intIdentify(value2) && value2 >= 0)
        return prefix + value2.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value2) => intIdentify(value2) && value2 >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value2) => intIdentify(value2) && value2 >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value2) {
      return typeof value2 === "bigint" || Number.isInteger(value2);
    }
    var stringifyJSON = ({ value: value2 }) => JSON.stringify(value2);
    var jsonScalars = [
      {
        identify: (value2) => typeof value2 === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value2) => value2 == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value2) => typeof value2 === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value: value2 }) => intIdentify(value2) ? value2.toString() : JSON.stringify(value2)
      },
      {
        identify: (value2) => typeof value2 === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value2) => value2 instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value: value2 }, ctx, onComment, onChompKeep) {
        if (!value2)
          return "";
        const buf = value2;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value2;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value2 = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value2 = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value2, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value2;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value2 = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value2);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value2) => value2 instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value: value2, source }, ctx) {
      const boolObj = value2 ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value2 ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value2) => value2 === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value2) => value2 === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value2) => typeof value2 === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value2) => typeof value2 === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value2) => typeof value2 === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value2) => typeof value2 === "bigint" || Number.isInteger(value2);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value: value2 } = node;
      if (intIdentify(value2)) {
        const str = value2.toString(radix);
        return value2 < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value2) {
        if (typeof value2 !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value2}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value2) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value2) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value2 of iterable) {
            if (typeof replacer === "function")
              value2 = replacer.call(iterable, value2, value2);
            set2.items.push(Pair.createPair(value2, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value2) => value2 instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value: value2 } = node;
      let num = (n) => n;
      if (typeof value2 === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value2) || !isFinite(value2))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value2 < 0) {
        sign = "-";
        value2 *= num(-1);
      }
      const _60 = num(60);
      const parts = [value2 % _60];
      if (value2 < 60) {
        parts.unshift(0);
      } else {
        value2 = (value2 - parts[0]) / _60;
        parts.unshift(value2 % _60);
        if (value2 >= 60) {
          value2 = (value2 - parts[0]) / _60;
          parts.unshift(value2);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value2) => typeof value2 === "bigint" || Number.isInteger(value2),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value2) => typeof value2 === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value2) => value2 instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value: value2 }) => value2?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify2 = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify2.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify2.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify2.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value2, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value2 === void 0 ? null : this.createNode(value2, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value2) {
        if (assertCollection(this.contents))
          this.contents.add(value2);
      }
      /** Adds a value to the document. */
      addIn(path18, value2) {
        if (assertCollection(this.contents))
          this.contents.addIn(path18, value2);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value2, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value2 = replacer.call({ "": value2 }, "", value2);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value2, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value2, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value2, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path18) {
        if (Collection.isEmptyPath(path18)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path18) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path18, keepScalar) {
        if (Collection.isEmptyPath(path18))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path18, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path18) {
        if (Collection.isEmptyPath(path18))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path18) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value2) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value2);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value2);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path18, value2) {
        if (Collection.isEmptyPath(path18)) {
          this.contents = value2;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path18), value2);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path18, value2);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens2, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens2) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens2[tokens2.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items2, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items2.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value: value2 } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value2,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value2?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value2 ? composeNode(ctx, value2, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value2, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value: value2 } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value2,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value2) {
            if (value2?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value2 ? composeNode(ctx, value2, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value2, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value: value2 } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value2) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value2 ? composeNode(ctx, value2, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value2))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value2,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value2) {
            if ("source" in value2 && value2.source?.[0] === ":")
              onError(value2, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value2 ? composeNode(ctx, value2, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value2))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value3 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value3, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value2 = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value2 += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value2 += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value2 += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value2 += "\n";
          else
            sep = "\n";
        } else {
          value2 += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value2 += "\n" + lines[i][0].slice(trimIndent);
          if (value2[value2.length - 1] !== "\n")
            value2 += "\n";
          break;
        default:
          value2 += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value: value2, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value2;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value2 = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value2 = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value2 = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value: value2,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return unfoldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return unfoldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function unfoldLines(source) {
      const line = /(.*?)\r?\n/sy;
      let match = line.exec(source);
      if (!match)
        return source;
      let trimEnd, trimBoth;
      try {
        trimEnd = new RegExp("(?<![ 	])[ 	]+$");
        trimBoth = new RegExp("^[ 	]+|(?<![ 	])[ 	]+$", "g");
      } catch {
        trimEnd = /[ \t]+$/;
        trimBoth = /^[ \t]+|[ \t]+$/g;
      }
      let res = match[1].replace(trimEnd, "");
      let sep = " ";
      let pos = line.lastIndex;
      while (match = line.exec(source)) {
        const lm = match[1].replace(trimBoth, "");
        if (lm === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + lm;
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value: value2, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value2, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value2, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value2, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value2);
      }
      scalar.range = range;
      scalar.source = value2;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value2, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value2))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value2, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value2)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value2)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value: value2, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value2 ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value2 && (value2.type === "block-map" || value2.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value2 ? composeNode.composeNode(ctx, value2, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens2, forceDoc = false, endOffset = -1) {
        for (const token of tokens2)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value2, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value: value2 }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value2, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value: value2 }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify2 = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value: value2 }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value2)
        res += stringifyToken(value2);
      return res;
    }
    exports.stringify = stringify2;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path18) => {
      let item = cst;
      for (const [field, index] of path18) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path18) => {
      const parent = visit.itemAtPath(cst, path18.slice(0, -1));
      const field = path18[path18.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path18, item, visitor) {
      let ctrl = visitor(item, path18);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path18.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path18);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path18) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list2, type) {
      for (let i = 0; i < list2.length; ++i)
        if (list2[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list2) {
      for (let i = 0; i < list2.length; ++i) {
        switch (list2[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log3 = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse5(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log3.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify2(value2, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value2 === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value2) && !_replacer)
        return value2.toString(options);
      return new Document.Document(value2, _replacer, options).toString(options);
    }
    exports.parse = parse5;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument;
    exports.stringify = stringify2;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// src/cli/index.ts
import os4 from "node:os";
import path17 from "node:path";

// src/cli/doctor.ts
import { existsSync as existsSync4, readFileSync as readFileSync5, readdirSync as readdirSync2, statSync as statSync2, writeFileSync as writeFileSync3, unlinkSync } from "node:fs";
import { spawnSync as spawnSync2 } from "node:child_process";
import path7 from "node:path";

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

// src/kb/db.ts
import { createRequire as requireFrom } from "node:module";
import path2 from "node:path";
var DDL = `
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
var WEIGHTS = [["facet_value", 3], ["facet_key", 1], ["environment", 2], ["subject", 2], ["gate_rank", 1], ["recency", 1], ["transfer_confirmed", 2], ["transfer_refuted", -2], ["conflict", -3], ["expired_factor", 0.5]];
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
function openDb(file = path2.join(paths.stateDir(), "kb.sqlite")) {
  const sql = new (loadSqlite()).DatabaseSync(file);
  sql.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON;");
  sql.exec(DDL);
  const ins = sql.prepare("INSERT OR IGNORE INTO rank_weights(key, value) VALUES (?, ?)");
  for (const [k, v] of WEIGHTS) ins.run(k, v);
  return { sql, file };
}
function deviceId() {
  return process.env.PROJECT_MEMORY_DEVICE ?? paths.config().deviceId ?? "unknown";
}
function upsertNote(db, n) {
  db.sql.prepare(`INSERT INTO note(id,kind,domain,project,title,body,created_at,updated_at,deleted_at,device_id) VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, domain=excluded.domain, project=excluded.project, title=excluded.title, body=excluded.body, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, device_id=excluded.device_id`).run(n.id, n.kind, n.domain, n.project, n.title, n.body, n.created_at, n.updated_at, n.deleted_at, n.device_id);
  reindexFts(db, n.id);
}
function setAttrs(db, noteId2, attrs) {
  db.sql.prepare("DELETE FROM attr WHERE note_id=?").run(noteId2);
  const ins = db.sql.prepare("INSERT OR IGNORE INTO attr(note_id,key,value) VALUES(?,?,?)");
  for (const [k, v] of Object.entries(attrs)) for (const val of Array.isArray(v) ? v : [v]) ins.run(noteId2, k, String(val));
}
function addRel(db, r) {
  db.sql.prepare("INSERT OR REPLACE INTO rel(id,src,type,dst,props,created_at,deleted_at) VALUES(?,?,?,?,?,?,?)").run(r.id, r.src, r.type, r.dst, JSON.stringify(r.props ?? {}), r.created_at, r.deleted_at);
}
function softDeleteNote(db, id, at = (/* @__PURE__ */ new Date()).toISOString()) {
  db.sql.prepare("UPDATE note SET deleted_at=?, updated_at=? WHERE id=?").run(at, at, id);
  reindexFts(db, id);
}
function getNote(db, id) {
  return db.sql.prepare("SELECT * FROM note WHERE id=?").get(id) ?? null;
}
function getAttrs(db, id) {
  const out = {};
  for (const r of db.sql.prepare("SELECT key, value FROM attr WHERE note_id=? ORDER BY key, value").all(id)) (out[r.key] ??= []).push(r.value);
  return out;
}
function getRels(db, id, dir = "out") {
  const where = dir === "out" ? "src=?" : dir === "in" ? "dst=?" : "(src=? OR dst=?)";
  const args2 = dir === "both" ? [id, id] : [id];
  return db.sql.prepare(`SELECT * FROM rel WHERE ${where} AND deleted_at IS NULL ORDER BY created_at`).all(...args2).map((r) => ({ ...r, props: JSON.parse(r.props) }));
}
function reindexFts(db, noteId2) {
  const n = getNote(db, noteId2);
  db.sql.prepare("DELETE FROM note_fts WHERE note_id=?").run(noteId2);
  if (n && !n.deleted_at) db.sql.prepare("INSERT INTO note_fts(note_id,title,body) VALUES(?,?,?)").run(noteId2, n.title, n.body);
}

// src/kb/project.ts
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import path4 from "node:path";

// src/lib/log.ts
import { appendFileSync } from "node:fs";
import path3 from "node:path";
function log(level, msg, data) {
  try {
    appendFileSync(path3.join(paths.logsDir(), "hooks.log"), JSON.stringify({ t: (/* @__PURE__ */ new Date()).toISOString(), level, msg, data }) + "\n", "utf8");
  } catch {
  }
}

// src/kb/project.ts
function loadProjectConfig(cwd) {
  let dir = path4.resolve(cwd);
  for (let i = 0; i < 8; i++) {
    const f = path4.join(dir, ".kb.json");
    if (existsSync2(f)) {
      let c;
      try {
        c = JSON.parse(readFileSync2(f, "utf8"));
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
    const up = path4.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

// src/cli/baseline.ts
import { readdirSync, readFileSync as readFileSync3, statSync } from "node:fs";
import path5 from "node:path";
function computeBaseline(projectsDir) {
  const files = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = path5.join(d, f);
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
    for (const line of readFileSync3(f, "utf8").split("\n")) {
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
import { existsSync as existsSync3, mkdirSync as mkdirSync2, mkdtempSync, readFileSync as readFileSync4, writeFileSync as writeFileSync2 } from "node:fs";
import { tmpdir } from "node:os";
import path6 from "node:path";
import { fileURLToPath } from "node:url";

// src/lib/transcript.ts
import { openSync, readSync, fstatSync, closeSync } from "node:fs";
function readTranscript(path18, fromOffset = 0) {
  const fd = openSync(path18, "r");
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
  const log3 = { type: "command", command: "node", args: [probe, "log", logFile], timeout: 10 };
  return { hooks: {
    SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "node", args: [probe, "brief", logFile], timeout: 10 }] }, { matcher: "compact|resume", hooks: [log3] }],
    PostToolUse: [{ matcher: "Bash", hooks: [plugin("post-tool-use", 10)] }, { matcher: "Read", hooks: [log3] }],
    SubagentStart: [{ hooks: [plugin("subagent-start", 5)] }],
    PreCompact: [{ hooks: [plugin("pre-compact", 30), log3] }],
    PostCompact: [{ hooks: [plugin("post-compact", 15), log3] }]
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
  for (let d = path6.dirname(fileURLToPath(import.meta.url)); ; d = path6.dirname(d)) {
    const f = path6.join(d, "dist", "hook.js");
    if (existsSync3(f)) return f;
    if (path6.dirname(d) === d) throw new Error("dist/hook.js not found; run npm run build");
  }
}
function runLiveTest(opts = {}) {
  const hookJs = opts.hookJs ?? findHookJs();
  const claude = opts.claude ?? "claude";
  const dir = mkdtempSync(path6.join(tmpdir(), "pm-live-"));
  const state = path6.join(dir, "state");
  const probe = path6.join(dir, "probe.mjs");
  const logFile = path6.join(dir, "events.jsonl");
  mkdirSync2(path6.join(dir, ".claude"));
  writeFileSync2(probe, PROBE_MJS);
  writeFileSync2(path6.join(dir, "hello.txt"), "hello from the project-memory live test\n");
  writeFileSync2(path6.join(dir, ".claude", "settings.json"), JSON.stringify(liveSettings(hookJs, probe, logFile), null, 2));
  const { CLAUDECODE: _nested, ...env } = process.env;
  const run = (args2) => spawnSync(
    claude,
    [...args2, "--permission-mode", "bypassPermissions", "--model", "claude-haiku-5-5", "--max-turns", "12", "--output-format", "json", "--setting-sources", "project"],
    { cwd: dir, env: { ...env, PROJECT_MEMORY_HOME: state }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 6e5, maxBuffer: 64 * 1024 * 1024 }
  );
  const started = Date.now();
  const lines = [`dir: ${dir}`];
  const r1 = run(["-p", PROMPT]);
  const out1 = r1.stdout ?? "", err1 = (r1.stderr ?? "").trim();
  const j1 = parse(out1);
  lines.push(`run1: exit ${r1.status}${r1.error ? ` error: ${r1.error.message}` : ""}${err1 ? ` stderr: ${err1}` : ""}`, `run1 result: ${j1?.result ?? out1.slice(0, 1e3)}`);
  if (j1?.session_id) {
    const r2 = run(["-p", "/compact", "--resume", j1.session_id]);
    const out2 = r2.stdout ?? "", err2 = (r2.stderr ?? "").trim();
    lines.push(`run2 (/compact): exit ${r2.status}${r2.error ? ` error: ${r2.error.message}` : ""}${err2 ? ` stderr: ${err2}` : ""}`, `run2 result: ${parse(out2)?.result ?? out2.slice(0, 1e3)}`);
  }
  const wallMs = Date.now() - started;
  const events = existsSync3(logFile) ? readFileSync4(logFile, "utf8").split("\n").map(parse).filter(Boolean) : [];
  const tp = events.find((e) => e.transcript_path)?.transcript_path;
  const texts = tp && existsSync3(tp) ? userTexts(readTranscript(tp).entries) : [];
  const auditExists = typeof j1?.session_id === "string" && existsSync3(path6.join(state, "sessions", j1.session_id, "main", "audit.json"));
  lines.push(`events: ${events.map((e) => `${e.ev}${e.source ? `(${e.source})` : ""}${e.tool_name ? `(${e.tool_name})` : ""}`).join(" \u2192 ") || "none logged"}`, `audit.json: ${auditExists ? "present" : "absent"}`);
  const hooksLog = path6.join(state, "logs", "hooks.log");
  if (existsSync3(hooksLog)) lines.push("hooks.log:", readFileSync4(hooksLog, "utf8").trim());
  return { ...evaluate({ result: String(j1?.result ?? ""), texts, events, auditExists }), wallMs, log: lines.join("\n") };
}

// src/cli/doctor.ts
var readJsonFile = (f) => {
  try {
    return JSON.parse(readFileSync5(f, "utf8"));
  } catch {
    return null;
  }
};
function fts5Probe() {
  try {
    const { DatabaseSync } = loadSqlite();
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE VIRTUAL TABLE t USING fts5(x)");
    db.close();
    return { status: "PASS", name: "sqlite-fts5", detail: "node:sqlite creates an FTS5 table" };
  } catch (e) {
    return { status: "FAIL", name: "sqlite-fts5", detail: `node:sqlite FTS5 probe failed: ${e?.message ?? e}` };
  }
}
function installedPlugins(home2) {
  const dir = path7.join(home2, ".claude", "plugins"), j = readJsonFile(path7.join(dir, "installed_plugins.json")), markets = readJsonFile(path7.join(dir, "known_marketplaces.json")) ?? {};
  const runDir = (name, cached) => {
    const [plugin, market] = name.split("@"), m = markets[market];
    if (m?.source?.source !== "directory") return cached;
    const root = m.installLocation ?? m.source.path, src = readJsonFile(path7.join(root, ".claude-plugin", "marketplace.json"))?.plugins?.find((p) => p?.name === plugin)?.source;
    return typeof src === "string" ? path7.resolve(root, src) : cached;
  };
  return Object.entries(j?.plugins ?? {}).flatMap(([name, entries]) => (Array.isArray(entries) ? entries : []).filter((e) => typeof e?.installPath === "string").map((e) => ({ name, installPath: runDir(name, e.installPath) })));
}
function bankChecks() {
  const bank = paths.bankDir();
  if (!existsSync4(path7.join(bank, ".git"))) return [{ status: "WARN", name: "bank", detail: `${bank} is not a git repository (run \`kb init\`)` }];
  const g = (args2, timeout = 6e4) => spawnSync2("git", args2, { cwd: bank, encoding: "utf8", timeout });
  const st = g(["status", "--porcelain"]);
  if (st.error) return [{ status: "WARN", name: "bank", detail: `${bank}: git failed: ${st.error.message}` }];
  const dirty = (st.stdout ?? "").trim() ? "dirty" : "clean";
  const ab = g(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);
  const [ahead, behind] = (ab.stdout ?? "").trim().split(/\s+/);
  const out = [{ status: "PASS", name: "bank", detail: `${bank}: ${dirty}, ${ab.status === 0 ? `ahead ${ahead} behind ${behind}` : "no upstream yet"}` }];
  const remote = (g(["remote"]).stdout ?? "").split("\n")[0].trim();
  if (!remote) out.push({ status: "INFO", name: "bank-remote", detail: "no remote configured; kb sync stops at no-remote" });
  else {
    const ls = g(["ls-remote", "-q", remote], 1e4);
    out.push(ls.status === 0 ? { status: "PASS", name: "bank-remote", detail: `${remote} reachable (${(g(["remote", "get-url", remote]).stdout ?? "").trim()})` } : { status: "WARN", name: "bank-remote", detail: `${remote} unreachable: ${(ls.error?.message || ls.stderr || `exit ${ls.status}`).trim()}` });
  }
  return out;
}
function indexChecks() {
  const file = path7.join(paths.stateDir(), "kb.sqlite"), at = paths.config().lastSyncAt ?? "unknown time";
  if (!existsSync4(file)) return [{ status: "INFO", name: "index", detail: "no kb.sqlite yet (kb init builds it)" }, { status: "INFO", name: "last-sync", detail: "never" }];
  let db;
  try {
    db = openDb(file);
  } catch (e) {
    return [{ status: "FAIL", name: "index", detail: `${file}: ${e?.message ?? e}` }];
  }
  try {
    const counts = db.sql.prepare("SELECT kind, COUNT(*) AS n FROM note WHERE deleted_at IS NULL GROUP BY kind ORDER BY kind").all().map((r) => `${r.kind} ${r.n}`).join(", ") || "no notes";
    const pending = db.sql.prepare("SELECT COUNT(*) AS n FROM pending_merge WHERE resolved IS NULL").get().n;
    const result = db.sql.prepare("SELECT value FROM meta WHERE key='lastSyncResult'").get()?.value;
    return [
      { status: "INFO", name: "index", detail: `${file} ${(statSync2(file).size / 1048576).toFixed(1)} MB: ${counts}` },
      { status: "INFO", name: "pending-merges", detail: pending ? `${pending} awaiting review (kb concepts review)` : "none" },
      !result ? { status: "INFO", name: "last-sync", detail: "never" } : { status: result.startsWith("failed") ? "WARN" : result === "ok" ? "PASS" : "INFO", name: "last-sync", detail: `${result} at ${at}${result.includes("rebase conflict") ? ` \u2014 resolve with git in ${paths.bankDir()}, then kb sync` : ""}` }
    ];
  } finally {
    db.sql.close();
  }
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
  const git3 = spawnSync2("git", ["--version"], { encoding: "utf8" });
  out.push(git3.status === 0 ? { status: "PASS", name: "git", detail: git3.stdout.trim() } : { status: "FAIL", name: "git", detail: "git not found on PATH" });
  const kb = loadProjectConfig(process.cwd());
  out.push(kb ? { status: "PASS", name: "kb-json", detail: `project ${kb.project_id} (domain ${kb.domain})` } : { status: "WARN", name: "kb-json", detail: `no valid .kb.json in ${process.cwd()} (missing project_id or domain): run kb project init` });
  out.push(...bankChecks(), ...indexChecks());
  const state = paths.stateDir();
  try {
    const probe = path7.join(state, `.doctor-${process.pid}`);
    writeFileSync3(probe, "ok");
    unlinkSync(probe);
    out.push({ status: "PASS", name: "state-dir", detail: `${state} writable` });
  } catch (e) {
    out.push({ status: "FAIL", name: "state-dir", detail: `${state} not writable: ${e?.message ?? e}` });
  }
  const blobs = readdirSync2(paths.blobsDir()).filter((f) => f.length === 64).map((f) => statSync2(path7.join(paths.blobsDir(), f)));
  const bytes = blobs.reduce((n, s) => n + s.size, 0);
  const oldest = blobs.length ? new Date(Math.min(...blobs.map((s) => s.mtimeMs))).toISOString() : "none";
  out.push({ status: "INFO", name: "blobs", detail: `${blobs.length} blobs, ${(bytes / 1048576).toFixed(1)} MB, oldest ${oldest}` });
  const sessionsDir = path7.join(state, "sessions");
  out.push({ status: "INFO", name: "sessions", detail: `${existsSync4(sessionsDir) ? readdirSync2(sessionsDir).length : 0} session dirs` });
  const settings = readJsonFile(path7.join(home2, ".claude", "settings.json")) ?? {};
  out.push(settings.autoCompactWindow === 333e3 ? { status: "PASS", name: "autoCompactWindow", detail: "333000" } : { status: "WARN", name: "autoCompactWindow", detail: `${settings.autoCompactWindow ?? "unset"} (run \`kb setup\` to set 200000)` });
  const enabled = settings.enabledPlugins ?? {};
  const installed = installedPlugins(home2);
  const ours = installed.filter((p) => p.name.startsWith("project-memory@"));
  const live2 = ours.find((p) => enabled[p.name] && existsSync4(path7.join(p.installPath, "hooks", "hooks.json")) && existsSync4(path7.join(p.installPath, "dist", "hook.js")));
  out.push(live2 ? { status: "PASS", name: "hooks", detail: `${live2.name} hooks present in ${live2.installPath}` } : { status: "WARN", name: "hooks", detail: ours.length ? `${ours[0].name} installed but not enabled or ${ours[0].installPath} lacks hooks/hooks.json + dist/hook.js` : "project-memory plugin not installed in the plugin cache" });
  const collisions = [];
  for (const p of installed) {
    if (!enabled[p.name] || p.name.startsWith("project-memory@")) continue;
    const hooks = readJsonFile(path7.join(p.installPath, "hooks", "hooks.json"))?.hooks ?? {};
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
    process.stdout.write("\n");
    if (v.status !== 0) {
      const c = { status: "FAIL", name: "live:claude", detail: `claude --version failed (${v.error?.message ?? `exit ${v.status}`}); live test skipped` };
      checks.push(c);
      print(c);
    } else {
      print({ status: "INFO", name: "live:claude", detail: (v.stdout ?? "").trim() });
      process.stdout.write(`live marker test (two headless runs, about two minutes)...
`);
      const r = runLiveTest();
      const live2 = liveChecks(r);
      checks.push(...live2);
      for (const c of live2) print(c);
      process.stdout.write(`${live2.some((c) => c.status === "FAIL") ? r.log : r.log.split("\n")[0]}
`);
    }
  }
  if (opts.baseline) {
    const dir = path7.join(home2, ".claude", "projects");
    if (!existsSync4(dir)) process.stdout.write(`
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
import { existsSync as existsSync7, readFileSync as readFileSync8, readdirSync as readdirSync3, statSync as statSync4, rmSync, mkdirSync as mkdirSync3, cpSync } from "node:fs";
import path9 from "node:path";

// src/cli/backup.ts
import { copyFileSync, existsSync as existsSync6, readFileSync as readFileSync7 } from "node:fs";

// src/lib/atomic.ts
import { writeFileSync as writeFileSync4, readFileSync as readFileSync6, renameSync as renameSync2, realpathSync, existsSync as existsSync5, statSync as statSync3, chmodSync, unlinkSync as unlinkSync2 } from "node:fs";
import path8 from "node:path";
import { randomBytes } from "node:crypto";
function writeFileAtomic(filePath, data) {
  const dir = realpathSync(path8.dirname(filePath));
  const target = path8.join(dir, path8.basename(filePath));
  const tmp = path8.join(dir, `.${path8.basename(filePath)}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`);
  const mode = existsSync5(target) ? statSync3(target).mode & 511 : void 0;
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
  if (existsSync6(file)) copyFileSync(file, `${file}.bak-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}`);
}
function backupAndWriteJson(file, value2) {
  backupFile(file);
  writeFileAtomic(file, JSON.stringify(value2, null, 2) + "\n");
}
function editJson(file, mutate) {
  const j = existsSync6(file) ? JSON.parse(readFileSync7(file, "utf8")) : {};
  mutate(j);
  backupAndWriteJson(file, j);
}

// src/cli/cleanup.ts
var readJsonFile2 = (f) => existsSync7(f) ? JSON.parse(readFileSync8(f, "utf8")) : {};
function onPath(cmd2) {
  if (cmd2.includes("/") || cmd2.includes("\\")) return existsSync7(cmd2);
  const exts = process.platform === "win32" ? ["", ...(process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")] : [""];
  return (process.env.PATH ?? "").split(path9.delimiter).some((dir) => dir && exts.some((e) => existsSync7(path9.join(dir, cmd2 + e))));
}
function deadPath(arg) {
  if (typeof arg !== "string" || !path9.isAbsolute(arg) || arg.length < 2) return false;
  if (!existsSync7(arg)) return true;
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
  const settingsPath = path9.join(home2, ".claude", "settings.json");
  const claudeJson = path9.join(home2, ".claude.json");
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
  const am = path9.join(home2, ".agentmemory");
  if (existsSync7(am)) actions.push({ id: "dir:.agentmemory", kind: "remove-dir", target: am, reason: "agentmemory state; its backups/ are copied to ~/.project-memory/imports/agentmemory first", apply: () => {
    const src = path9.join(am, "backups");
    const dest = path9.join(home2, ".project-memory", "imports", "agentmemory", "backups");
    if (existsSync7(src)) {
      mkdirSync3(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
    }
    rmSync(am, { recursive: true, force: true });
  } });
  return actions;
}

// src/cli/setup.ts
import os2 from "node:os";
import path10 from "node:path";
import { existsSync as existsSync8, readFileSync as readFileSync9, appendFileSync as appendFileSync2 } from "node:fs";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var defaultDeviceId = (host = os2.hostname()) => host.split(".")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-");
var HEADING = "## Compaction instructions (project-memory)";
function compactionInstructionsPath() {
  const here = path10.dirname(fileURLToPath2(import.meta.url));
  return [path10.join(here, "..", "skills", "kb", "compaction-instructions.md"), path10.join(here, "..", "..", "skills", "kb", "compaction-instructions.md")].find(existsSync8) ?? path10.join(here, "..", "skills", "kb", "compaction-instructions.md");
}
var AUTO_COMPACT_WINDOW = 333e3;
function setup(home2, opts = {}) {
  const print = opts.print ?? ((l) => process.stdout.write(l + "\n"));
  const settingsPath = path10.join(home2, ".claude", "settings.json");
  const settings = existsSync8(settingsPath) ? JSON.parse(readFileSync9(settingsPath, "utf8")) : {};
  if (settings.autoCompactWindow === AUTO_COMPACT_WINDOW) print(`autoCompactWindow already ${AUTO_COMPACT_WINDOW} in ${settingsPath}`);
  else {
    editJson(settingsPath, (s) => {
      s.autoCompactWindow = AUTO_COMPACT_WINDOW;
    });
    print(`set autoCompactWindow: ${AUTO_COMPACT_WINDOW} in ${settingsPath} (backup written)`);
  }
  const deviceId2 = defaultDeviceId(opts.device ?? os2.hostname());
  paths.saveConfig({ deviceId: deviceId2 });
  print(`deviceId: ${deviceId2} (${paths.configPath()})`);
  const instructions = compactionInstructionsPath();
  const claudeMd = path10.join(home2, ".claude", "CLAUDE.md");
  if (!opts.appendClaudeMd) {
    print(`compaction instructions: ${instructions}`);
    print("  run `kb setup --append-claude-md` to append them to ~/.claude/CLAUDE.md");
    return;
  }
  if (existsSync8(claudeMd) && readFileSync9(claudeMd, "utf8").includes(HEADING)) {
    print(`${claudeMd} already carries the compaction instructions`);
    return;
  }
  backupFile(claudeMd);
  appendFileSync2(claudeMd, `
${HEADING}

${readFileSync9(instructions, "utf8")}`);
  print(`appended compaction instructions to ${claudeMd} (backup written)`);
}

// src/cli/init.ts
import { spawnSync as spawnSync4 } from "node:child_process";
import { copyFileSync as copyFileSync2, existsSync as existsSync11, mkdirSync as mkdirSync6, readFileSync as readFileSync12, readdirSync as readdirSync5, writeFileSync as writeFileSync5 } from "node:fs";
import path13 from "node:path";
import { fileURLToPath as fileURLToPath3 } from "node:url";

// src/kb/normalize.ts
var STOP = new Set("a an and are as at be by for from has have in is it its of on or that the this to was were will with".split(" "));
var isCons = (w, i) => {
  const c = w[i];
  if ("aeiou".includes(c)) return false;
  return c === "y" ? i === 0 || !isCons(w, i - 1) : true;
};
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
var hasVowel = (w) => [...w].some((_, i) => !isCons(w, i));
var doubleCons = (w) => w.length >= 2 && w.at(-1) === w.at(-2) && isCons(w, w.length - 1);
var cvc = (w) => {
  const n = w.length;
  return n >= 3 && isCons(w, n - 3) && !isCons(w, n - 2) && isCons(w, n - 1) && !"wxy".includes(w[n - 1]);
};
function rule(w, pairs, cond) {
  for (const [s, r] of pairs) if (w.endsWith(s)) {
    const stem2 = w.slice(0, -s.length);
    return cond(stem2) ? stem2 + r : w;
  }
  return w;
}
var P = (s) => s.split(" ").map((p) => p.split(">"));
var STEP2 = P("ational>ate tional>tion enci>ence anci>ance izer>ize bli>ble alli>al entli>ent eli>e ousli>ous ization>ize ation>ate ator>ate alism>al iveness>ive fulness>ful ousness>ous aliti>al iviti>ive biliti>ble logi>log");
var STEP3 = P("icate>ic ative> alize>al iciti>ic ical>ic ful> ness>");
var STEP4 = "al ance ence er ic able ible ant ement ment ent ion ou ism ate iti ous ive ize".split(" ");
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
var normalizeName = (name) => tokens(name).join("-");
function dice(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size && !B.size) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return 2 * shared / (A.size + B.size);
}

// src/kb/templates.ts
var slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
var domainNoteId = (domain) => `d_${slug(domain).padEnd(26, "0").slice(0, 26)}`;
var templateNoteId = (domain) => `m_${slug(domain).padEnd(26, "0").slice(0, 26)}`;
var conceptNoteId = (name) => `c_${normalizeName(name).replace(/-/g, "").padEnd(26, "0").slice(0, 26)}`;
function installTemplate(db, t, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const base = { project: null, body: "", created_at: now, updated_at: now, deleted_at: null, device_id: "init" };
  upsertNote(db, { id: domainNoteId(t.domain), kind: "domain", domain: t.domain, title: t.domain, ...base });
  upsertNote(db, { id: templateNoteId(t.domain), kind: "template", domain: t.domain, title: `${t.domain} template`, ...base });
  setAttrs(db, templateNoteId(t.domain), { facet: t.facets, method: t.methods, ...Object.fromEntries(t.gates.map((g, i) => [`gate:${i}`, g])), env_axis: t.environment, subject_axis: t.subject });
  const ins = db.sql.prepare("INSERT OR IGNORE INTO alias(name_norm, concept_id) VALUES(?,?)");
  for (const c of t.seed_concepts ?? []) {
    const id = conceptNoteId(c.name), aliases = c.aliases ?? [];
    upsertNote(db, { id, kind: "concept", domain: null, title: c.name, ...base });
    const attrs = getAttrs(db, id);
    attrs.alias = [.../* @__PURE__ */ new Set([...attrs.alias ?? [], ...aliases])];
    if (attrs.alias.length) setAttrs(db, id, attrs);
    for (const a of [c.name, ...aliases]) ins.run(normalizeName(a), id);
  }
}
function templateFor(db, domain) {
  const a = {};
  for (const r of db.sql.prepare("SELECT key, value FROM attr WHERE note_id=? ORDER BY rowid").all(templateNoteId(domain))) (a[r.key] ??= []).push(r.value);
  if (!a.facet) return null;
  const gates = Object.entries(a).filter(([k]) => k.startsWith("gate:")).sort(([x], [y]) => Number(x.slice(5)) - Number(y.slice(5))).map(([, v]) => v[0]);
  return { domain, facets: a.facet, methods: a.method ?? [], gates, environment: a.env_axis?.[0] ?? "environment", subject: a.subject_axis?.[0] ?? "subject", seed_concepts: [] };
}
function validateApproachFacets(db, domain, facets) {
  const t = templateFor(db, domain);
  if (!t) throw new Error(`unknown domain ${domain}`);
  const bad = Object.keys(facets).filter((k) => !t.facets.includes(k));
  if (bad.length) throw new Error(`unknown facet keys ${bad.join(", ")} for ${domain}; allowed facet keys: ${t.facets.join(", ")}`);
}
function gateRank(db, domain, gate) {
  const t = templateFor(db, domain);
  if (!t) throw new Error(`unknown domain ${domain}`);
  const i = t.gates.indexOf(gate);
  if (i < 0) throw new Error(`unknown gate ${gate}; allowed gates: ${t.gates.join(" < ")}`);
  return i;
}

// src/kb/export.ts
var import_yaml2 = __toESM(require_dist(), 1);
import { createHash as createHash2 } from "node:crypto";
import { existsSync as existsSync9, mkdirSync as mkdirSync4, readFileSync as readFileSync11, readdirSync as readdirSync4 } from "node:fs";
import path11 from "node:path";

// src/kb/templates-yaml.ts
var import_yaml = __toESM(require_dist(), 1);
import { readFileSync as readFileSync10 } from "node:fs";
function loadTemplate(file) {
  return (0, import_yaml.parse)(readFileSync10(file, "utf8"));
}

// src/kb/export.ts
var sha256 = (s) => createHash2("sha256").update(s).digest("hex");
var cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
var relId = (src, type, dst, props) => `l_${sha256(`${src}|${type}|${dst}|${JSON.stringify(Object.fromEntries(Object.entries(props).sort(([a], [b]) => cmp(a, b))))}`).slice(0, 26)}`;
function rekeyRel(db, id, change) {
  const r = db.sql.prepare("SELECT * FROM rel WHERE id=?").get(id);
  if (!r) throw new Error(`no rel ${id}`);
  const dst = change.dst ?? r.dst, props = change.props ?? JSON.parse(r.props), next = relId(r.src, r.type, dst, props);
  db.sql.prepare("DELETE FROM rel WHERE id=?").run(id);
  addRel(db, { ...r, id: next, dst, props });
  return next;
}
function renderNoteFile(n, attrs, rels) {
  const fm = {
    id: n.id,
    kind: n.kind,
    domain: n.domain,
    project: n.project,
    title: n.title,
    created_at: n.created_at,
    updated_at: n.updated_at,
    device_id: n.device_id,
    ...n.deleted_at ? { deleted_at: n.deleted_at } : {},
    attrs: Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, v.length === 1 ? v[0] : v])),
    rels: [...rels].sort((a, b) => cmp(a.type, b.type) || cmp(a.dst, b.dst)).map((r) => ({ type: r.type, dst: r.dst, ...Object.keys(r.props ?? {}).length ? { props: r.props } : {} }))
  };
  return `---
${(0, import_yaml2.stringify)(fm, { sortMapEntries: true, lineWidth: 0 })}---
${n.body.replace(/\r\n?/g, "\n")}`;
}
function parseNoteFile(text) {
  const end = text.indexOf("\n---\n", 3);
  if (!text.startsWith("---\n") || end < 0) throw new Error("note file has no frontmatter");
  const fm = (0, import_yaml2.parse)(text.slice(4, end + 1)) ?? {};
  const note = {
    id: fm.id,
    kind: fm.kind,
    domain: fm.domain ?? null,
    project: fm.project ?? null,
    title: fm.title,
    body: text.slice(end + 5),
    created_at: fm.created_at,
    updated_at: fm.updated_at,
    deleted_at: fm.deleted_at ?? null,
    device_id: fm.device_id
  };
  if (typeof note.id !== "string" || typeof note.kind !== "string" || typeof note.title !== "string") throw new Error("note frontmatter needs id, kind and title");
  const attrs = Object.fromEntries(Object.entries(fm.attrs ?? {}).map(([k, v]) => [k, (Array.isArray(v) ? v : [v]).map(String)]));
  const rels = (fm.rels ?? []).map((r) => {
    const props = r.props ?? {};
    return { id: relId(note.id, r.type, r.dst, props), src: note.id, type: r.type, dst: r.dst, props, created_at: note.created_at, deleted_at: null };
  });
  return { note, attrs, rels };
}
var noteFile = (bankDir, n) => path11.join(bankDir, "notes", n.kind, `${n.id}.md`);
function exportNote(db, bankDir, id) {
  const n = getNote(db, id);
  if (!n) throw new Error(`no note ${id}`);
  const file = noteFile(bankDir, n);
  mkdirSync4(path11.dirname(file), { recursive: true });
  writeFileAtomic(file, renderNoteFile(n, getAttrs(db, id), getRels(db, id, "out")));
  return file;
}
function exportAll(db, bankDir) {
  const ids2 = db.sql.prepare("SELECT id FROM note ORDER BY id").all().map((r) => r.id);
  for (const id of ids2) exportNote(db, bankDir, id);
  return ids2.length;
}
function importFile(db, file) {
  const { note, attrs, rels } = parseNoteFile(readFileSync11(file, "utf8"));
  upsertNote(db, note);
  db.sql.prepare("UPDATE note SET created_at=? WHERE id=?").run(note.created_at, note.id);
  setAttrs(db, note.id, attrs);
  db.sql.prepare("DELETE FROM rel WHERE src=?").run(note.id);
  const ins = db.sql.prepare("INSERT OR REPLACE INTO rel(id,src,type,dst,props,created_at,deleted_at) VALUES(?,?,?,?,?,?,?)");
  for (const r of rels) ins.run(r.id, r.src, r.type, r.dst, JSON.stringify(r.props), r.created_at, null);
  if (note.kind === "concept" && note.deleted_at) db.sql.prepare("DELETE FROM alias WHERE concept_id=?").run(note.id);
  else if (note.kind === "concept") {
    const alias = db.sql.prepare("INSERT OR REPLACE INTO alias(name_norm, concept_id) VALUES(?,?)");
    for (const a of [note.title, ...attrs.alias ?? []]) alias.run(normalizeName(a), note.id);
  }
  return note;
}
function importNotes(db, bankDir) {
  const notes = path11.join(bankDir, "notes");
  let imported = 0, unchanged = 0;
  if (!existsSync9(notes)) return { imported, unchanged };
  const getMeta = db.sql.prepare("SELECT value FROM meta WHERE key=?");
  const setMeta = db.sql.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES(?,?)");
  for (const kind of readdirSync4(notes, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    for (const f of readdirSync4(path11.join(notes, kind)).filter((f2) => f2.endsWith(".md")).sort()) {
      const file = path11.join(notes, kind, f), key = `file:notes/${kind}/${f}`, hash = sha256(readFileSync11(file, "utf8"));
      if (getMeta.get(key)?.value === hash) {
        unchanged++;
        continue;
      }
      try {
        importFile(db, file);
      } catch (e) {
        throw new Error(`${file}: ${e.message}`, { cause: e });
      }
      setMeta.run(key, hash);
      imported++;
    }
  }
  return { imported, unchanged };
}
function inTransaction(db, fn) {
  db.sql.exec("BEGIN");
  try {
    const r = fn();
    db.sql.exec("COMMIT");
    return r;
  } catch (e) {
    db.sql.exec("ROLLBACK");
    throw e;
  }
}
function importAll(db, bankDir) {
  return inTransaction(db, () => importNotes(db, bankDir));
}
function rebuild(db, bankDir) {
  return inTransaction(db, () => {
    db.sql.exec(`DELETE FROM note; DELETE FROM attr; DELETE FROM rel; DELETE FROM alias; DELETE FROM note_fts; DELETE FROM meta WHERE key LIKE 'file:%';`);
    const templates = path11.join(bankDir, "templates");
    if (existsSync9(templates)) for (const f of readdirSync4(templates).filter((f2) => f2.endsWith(".yaml")).sort()) installTemplate(db, loadTemplate(path11.join(templates, f)));
    return importNotes(db, bankDir);
  });
}

// src/kb/sync.ts
import { existsSync as existsSync10, mkdirSync as mkdirSync5, rmdirSync, statSync as statSync5 } from "node:fs";
import { spawnSync as spawnSync3 } from "node:child_process";
import path12 from "node:path";
var LOCK = ".kb-sync.lock";
var LOCK_STALE_MS = 10 * 6e4;
var git = (cwd, ...args2) => spawnSync3("git", args2, { cwd, encoding: "utf8", timeout: 6e4 });
var gitIdentity = (cwd) => git(cwd, "var", "GIT_COMMITTER_IDENT").status === 0 ? [] : ["-c", "user.name=project-memory", "-c", `user.email=kb@${deviceId()}`];
var errText = (r) => (r.error?.message || r.stderr || `exit ${r.status}`).trim();
function lock(bank) {
  const dir = path12.join(bank, LOCK);
  for (let i = 0; i < 2; i++) {
    try {
      mkdirSync5(dir);
      return true;
    } catch (e) {
      if (e?.code !== "EEXIST") throw e;
    }
    try {
      if (Date.now() - statSync5(dir).mtimeMs < LOCK_STALE_MS) return false;
      rmdirSync(dir);
      log("warn", "sync: removed stale lock", dir);
    } catch {
      return false;
    }
  }
  return false;
}
function steps(db, bank) {
  const fail = (step, r2) => {
    log("error", `sync: ${step} failed`, { bank, detail: errText(r2) });
    return { result: "failed", reason: `${step} failed` };
  };
  let r = git(bank, "add", "-A");
  if (r.status !== 0) return fail("git add", r);
  const id = gitIdentity(bank);
  r = git(bank, ...id, "commit", "-q", "-m", `kb ${deviceId()} ${(/* @__PURE__ */ new Date()).toISOString()}`);
  if (r.status !== 0 && r.status !== 1) return fail("git commit", r);
  const remote = git(bank, "remote").stdout.split("\n")[0].trim();
  if (!remote) return { result: "no-remote" };
  r = git(bank, "fetch", "-q", remote);
  if (r.status !== 0) return fail("git fetch", r);
  const branch = git(bank, "symbolic-ref", "--short", "-q", "HEAD").stdout.trim(), upstream = `refs/remotes/${remote}/${branch}`;
  const before = git(bank, "rev-parse", "--verify", "-q", "HEAD").stdout.trim();
  if (git(bank, "rev-parse", "--verify", "-q", upstream).status === 0) {
    r = before ? git(bank, ...id, "rebase", "-q", upstream) : git(bank, "reset", "-q", "--hard", upstream);
    if (r.status !== 0) {
      git(bank, "rebase", "--abort");
      log("warn", "sync: rebase conflict, aborted; local commit intact", { bank, detail: errText(r) });
      return { result: "failed", reason: "rebase conflict" };
    }
  } else if (!before) return { result: "ok" };
  r = git(bank, "push", "-q", "-u", remote, branch);
  if (r.status !== 0) return fail("git push", r);
  try {
    const im = importAll(db, bank);
    if (im.imported) log("info", "sync: re-imported after pull", im);
  } catch (e) {
    log("error", "sync: import after pull failed", String(e));
    return { result: "failed", reason: "import failed" };
  }
  return { result: "ok" };
}
function record(db, result, reason) {
  paths.saveConfig({ lastSyncAt: (/* @__PURE__ */ new Date()).toISOString() });
  db.sql.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)").run("lastSyncResult", reason ? `${result} (${reason})` : result);
  return result;
}
function sync(bankDir) {
  const bank = path12.resolve(bankDir), db = openDb();
  try {
    if (!existsSync10(path12.join(bank, ".git"))) {
      log("warn", "sync: bank is not a git repository", bank);
      return record(db, "failed", "not a git repository");
    }
    if (!lock(bank)) return "busy";
    try {
      const { result, reason } = steps(db, bank);
      return record(db, result, reason);
    } finally {
      try {
        rmdirSync(path12.join(bank, LOCK));
      } catch {
      }
    }
  } finally {
    db.sql.close();
  }
}

// src/cli/init.ts
function shippedTemplatesDir() {
  const here = path13.dirname(fileURLToPath3(import.meta.url));
  return [path13.join(here, "..", "templates"), path13.join(here, "..", "..", "templates")].find(existsSync11) ?? path13.join(here, "..", "templates");
}
function git2(cwd, ...args2) {
  const r = spawnSync4("git", args2, { cwd, encoding: "utf8", timeout: 6e4 });
  if (r.status !== 0) throw new Error(`git ${args2.join(" ")} failed: ${(r.stderr || r.error?.message || "").trim()}`);
  return r.stdout;
}
function installBankTemplates(bank) {
  const dir = path13.join(bank, "templates");
  if (!existsSync11(dir)) return [];
  const db = openDb();
  const files = readdirSync5(dir).filter((f) => f.endsWith(".yaml")).sort();
  for (const f of files) installTemplate(db, loadTemplate(path13.join(dir, f)));
  db.sql.close();
  return files;
}
function initBank(opts = {}) {
  const print = opts.print ?? ((l) => process.stdout.write(l + "\n"));
  const bank = path13.resolve(opts.bank ?? paths.bankDir());
  const written = [];
  if (opts.clone) {
    mkdirSync6(path13.dirname(bank), { recursive: true });
    git2(path13.dirname(bank), "clone", "-q", opts.clone, bank);
    mkdirSync6(path13.join(bank, "notes"), { recursive: true });
    print(`cloned ${opts.clone} into ${bank}`);
  } else {
    mkdirSync6(bank, { recursive: true });
    if (!existsSync11(path13.join(bank, ".git"))) {
      if (readdirSync5(bank).length) throw new Error(`${bank} is not empty and not a git repository; pick an empty directory or an existing bank`);
      git2(bank, "init", "-q", "-b", "main");
    }
    if (!existsSync11(path13.join(bank, ".gitattributes"))) {
      writeFileSync5(path13.join(bank, ".gitattributes"), "* text=auto eol=lf\n");
      written.push(".gitattributes");
    }
    for (const d of ["templates", "notes"]) mkdirSync6(path13.join(bank, d), { recursive: true });
    const src = shippedTemplatesDir();
    for (const f of readdirSync5(src).filter((f2) => f2.endsWith(".yaml"))) {
      if (existsSync11(path13.join(bank, "templates", f))) continue;
      copyFileSync2(path13.join(src, f), path13.join(bank, "templates", f));
      written.push(`templates/${f}`);
    }
  }
  const installed = installBankTemplates(bank);
  if (opts.clone) {
    const db = openDb();
    try {
      print(`index rebuilt from the clone: ${rebuild(db, bank).imported} notes`);
    } finally {
      db.sql.close();
    }
  }
  paths.saveConfig({ bankDir: bank });
  print(`templates installed: ${installed.join(", ") || "none"}`);
  print(`bankDir: ${bank} (${paths.configPath()})`);
  if (written.length) {
    git2(bank, "add", "--", ...written);
    git2(bank, ...gitIdentity(bank), "commit", "-q", "-m", "kb init", "--only", "--", ...written);
    print("initial commit written");
  }
}
function projectInit(cwd, opts) {
  const file = path13.join(cwd, ".kb.json");
  const prev = existsSync11(file) ? JSON.parse(readFileSync12(file, "utf8")) : {};
  const c = { ...prev, project_id: opts.id ?? prev.project_id ?? path13.basename(path13.resolve(cwd)).toLowerCase(), domain: opts.domain };
  writeFileSync5(file, JSON.stringify(c, null, 2) + "\n");
  return c;
}

// src/kb/concepts.ts
import { appendFileSync as appendFileSync3, mkdirSync as mkdirSync7 } from "node:fs";
import path14 from "node:path";

// src/kb/ids.ts
import { randomBytes as randomBytes2 } from "node:crypto";
var ENC = "0123456789abcdefghjkmnpqrstvwxyz";
var lastTime = 0;
var lastRand = [];
function ulid(now = Date.now()) {
  let t = now, time = "";
  for (let i = 0; i < 10; i++) {
    time = ENC[t % 32] + time;
    t = Math.floor(t / 32);
  }
  if (now === lastTime) {
    for (let i = 15; i >= 0; i--) {
      if (lastRand[i] < 31) {
        lastRand[i]++;
        break;
      }
      lastRand[i] = 0;
    }
  } else {
    lastTime = now;
    lastRand = [...randomBytes2(16)].map((b) => b % 32);
  }
  return time + lastRand.map((x) => ENC[x]).join("");
}
var PREFIX = { domain: "d", template: "m", project: "p", theme: "h", approach: "a", experiment: "x", target: "t", concept: "c", finding: "f", evidence: "e", report: "r" };
var KINDS = Object.keys(PREFIX);
var noteId = (kind) => `${PREFIX[kind]}_${ulid()}`;
var evidenceId = (sha2564) => `e_${sha2564.slice(0, 16)}`;
function kindOfId(id) {
  const k = Object.entries(PREFIX).find(([, p]) => id.startsWith(p + "_"))?.[0];
  if (!k) throw new Error(`unknown id prefix: ${id}`);
  return k;
}

// src/lib/redaction.ts
var PATTERNS = [
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
var MAX_CHARS = 1e6;
var redactJson = (_k, v) => typeof v === "string" ? redactSensitive(v).text : v;
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

// src/kb/concepts.ts
var concepts = (db) => db.sql.prepare(`SELECT id, title FROM note WHERE kind='concept' AND deleted_at IS NULL ORDER BY id`).all();
var log2 = (bankDir, line) => {
  mkdirSync7(bankDir, { recursive: true });
  appendFileSync3(path14.join(bankDir, "concept-merges.md"), line + "\n");
};
var touch = (db, id, now) => db.sql.prepare("UPDATE note SET updated_at=? WHERE id=?").run(now, id);
function addAlias(db, id, names, now) {
  const attrs = getAttrs(db, id), title = normalizeName(getNote(db, id).title);
  const ins = db.sql.prepare("INSERT OR REPLACE INTO alias(name_norm, concept_id) VALUES(?,?)");
  for (const n of names) {
    ins.run(normalizeName(n), id);
    if (normalizeName(n) !== title) attrs.alias = [.../* @__PURE__ */ new Set([...attrs.alias ?? [], n])];
  }
  setAttrs(db, id, attrs);
  touch(db, id, now);
}
function createConcept(db, name, now) {
  const id = conceptNoteId(name);
  upsertNote(db, { id, kind: "concept", domain: null, project: null, title: name, body: "", created_at: now, updated_at: now, deleted_at: null, device_id: deviceId() });
  db.sql.prepare("INSERT OR REPLACE INTO alias(name_norm, concept_id) VALUES(?,?)").run(normalizeName(name), id);
  return id;
}
function resolveConcept(db, bankDir, tag, now) {
  tag = redactSensitive(tag).text;
  const norm = normalizeName(tag), all = concepts(db);
  const exact = all.find((c) => normalizeName(c.title) === norm);
  if (exact) return { conceptId: exact.id, how: "exact" };
  const hit = db.sql.prepare(`SELECT a.concept_id AS id FROM alias a JOIN note n ON n.id=a.concept_id WHERE a.name_norm=? AND n.deleted_at IS NULL`).get(norm);
  if (hit) return { conceptId: hit.id, how: "alias" };
  const t = tokens(tag), best = /* @__PURE__ */ new Map();
  for (const c of all) for (const name of [c.title, ...getAttrs(db, c.id).alias ?? []]) {
    const u = tokens(name), score = dice(t, u), shared = u.filter((x) => t.includes(x)).length;
    if (score > (best.get(c.id)?.score ?? -1)) best.set(c.id, { score, shared });
  }
  const ranked = [...best.entries()].sort((x, y) => y[1].score - x[1].score);
  const [top] = ranked;
  if (top && top[1].score >= 0.8 && top[1].shared >= 2 && ranked.filter(([, s]) => s.score >= 0.8).length === 1) {
    const [id2, { score }] = top;
    addAlias(db, id2, [tag], now);
    exportNote(db, bankDir, id2);
    log2(bankDir, `- ${now.slice(0, 10)} auto-merged "${tag}" into ${getNote(db, id2).title} (dice ${score.toFixed(2)}) \xB7 undo: kb concepts split "${norm}"`);
    return { conceptId: id2, how: "auto-alias", score };
  }
  const id = createConcept(db, tag, now);
  exportNote(db, bankDir, id);
  if (top && top[1].score >= 0.5) {
    const tie = ranked.filter(([, s]) => s.score === top[1].score).length > 1;
    db.sql.prepare("INSERT INTO pending_merge(id, a, b, score, reason, created_at, resolved) VALUES(?,?,?,?,?,?,NULL)").run(ulid(), id, top[0], top[1].score, tie ? "dice tie" : "dice", now);
    return { conceptId: id, how: "pending", score: top[1].score };
  }
  return { conceptId: id, how: "new" };
}
function openPending(db, id) {
  const p = db.sql.prepare("SELECT * FROM pending_merge WHERE id=?").get(id);
  if (!p) throw new Error(`no pending merge ${id}`);
  if (p.resolved) throw new Error(`pending merge ${id} is already ${p.resolved}`);
  return p;
}
function acceptMerge(db, bankDir, id, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const p = openPending(db, id), a = getNote(db, p.a), b = getNote(db, p.b);
  addAlias(db, b.id, [a.title, ...getAttrs(db, a.id).alias ?? []], now);
  const moved = db.sql.prepare(`SELECT id, src FROM rel WHERE dst=? AND type IN ('about','relies_on') AND deleted_at IS NULL`).all(a.id);
  for (const r of moved) rekeyRel(db, r.id, { dst: b.id });
  const srcs = [...new Set(moved.map((r) => r.src))];
  softDeleteNote(db, a.id, now);
  db.sql.prepare("UPDATE pending_merge SET resolved=? WHERE id=?").run("accepted", id);
  for (const n of [a.id, b.id, ...srcs]) {
    touch(db, n, now);
    exportNote(db, bankDir, n);
  }
  log2(bankDir, `- ${now.slice(0, 10)} merged "${a.title}" into ${b.title} (accepted ${id}) \xB7 undo: kb concepts split "${normalizeName(a.title)}"`);
}
function rejectMerge(db, id) {
  openPending(db, id);
  db.sql.prepare("UPDATE pending_merge SET resolved=? WHERE id=?").run("rejected", id);
}
function splitAlias(db, bankDir, nameNorm, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const row = db.sql.prepare("SELECT concept_id FROM alias WHERE name_norm=?").get(nameNorm);
  if (!row) throw new Error(`no alias ${nameNorm}`);
  const owner = getNote(db, row.concept_id);
  if (normalizeName(owner.title) === nameNorm) throw new Error(`"${nameNorm}" is the title of ${owner.id}, not an alias`);
  const attrs = getAttrs(db, owner.id), names = attrs.alias ?? [];
  const name = names.find((n) => normalizeName(n) === nameNorm) ?? nameNorm.replace(/-/g, " ");
  attrs.alias = names.filter((n) => normalizeName(n) !== nameNorm);
  if (!attrs.alias.length) delete attrs.alias;
  setAttrs(db, owner.id, attrs);
  touch(db, owner.id, now);
  exportNote(db, bankDir, owner.id);
  const id = createConcept(db, name, now);
  exportNote(db, bankDir, id);
  log2(bankDir, `- ${now.slice(0, 10)} split "${name}" out of ${owner.title} into ${id}`);
  return id;
}

// src/kb/rank.ts
var NOT_SUPERSEDED = `NOT EXISTS (SELECT 1 FROM rel s JOIN note m ON m.id=s.src AND m.deleted_at IS NULL WHERE s.type='supersedes' AND s.dst=n.id AND s.deleted_at IS NULL)`;
var LIVE_FINDING = `n.kind='finding' AND n.deleted_at IS NULL AND ${NOT_SUPERSEDED}`;
var marks = (xs) => xs.map(() => "?").join(",");
var ids = (rows) => rows.map((r) => r.id);
function conceptIds(db, names) {
  const q = db.sql.prepare("SELECT concept_id FROM alias WHERE name_norm=?");
  return [...new Set(names.map((n) => q.get(normalizeName(n))?.concept_id ?? conceptNoteId(n)))];
}
function findingsAbout(db, concepts2) {
  if (!concepts2.length) return [];
  return ids(db.sql.prepare(`SELECT DISTINCT n.id FROM rel r JOIN note n ON n.id=r.src WHERE r.type='about' AND r.deleted_at IS NULL AND r.dst IN (${marks(concepts2)}) AND ${LIVE_FINDING}`).all(...concepts2));
}

// src/kb/compare.ts
var live = (db, id) => {
  const n = getNote(db, id);
  return n && !n.deleted_at ? n : void 0;
};
var resolveConceptRef = (db, ref) => ref.startsWith("c_") && live(db, ref) ? ref : conceptIds(db, [ref])[0];
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
    const value2 = v !== void 0 && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
    return {
      findingId: id,
      approachValue,
      gate: a.gate?.[0] ?? null,
      gateRank: a.gate_rank ? Number(a.gate_rank[0]) : -1,
      metric: mk ? mk.slice(7) : null,
      value: value2,
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

// src/kb/brief.ts
function pendingQuestions(db, max = 3) {
  const rows = db.sql.prepare(`SELECT p.id, a.title AS at, b.title AS bt FROM pending_merge p JOIN note a ON a.id=p.a JOIN note b ON b.id=p.b
    WHERE p.resolved IS NULL ORDER BY p.score DESC, p.created_at, p.id LIMIT ?`).all(max);
  return rows.map((r) => `Merge "${r.at}" into "${r.bt}"? kb concepts accept ${r.id} | reject ${r.id}`);
}

// src/kb/write.ts
import { createHash as createHash3 } from "node:crypto";
var red = (s) => redactSensitive(s).text;
var sha2562 = (s) => createHash3("sha256").update(s).digest("hex");
var touch2 = (db, id, now) => db.sql.prepare("UPDATE note SET updated_at=? WHERE id=?").run(now, id);
var TARGET_FACETS = ["environment", "subject"];
var must = (db, id) => {
  const n = getNote(db, id);
  if (!n || n.deleted_at) throw new Error(`no note ${id}`);
  return n;
};
var WRITABLE_KINDS = ["project", "theme", "approach", "experiment", "target", "finding"];
function userRel(type, props = {}) {
  if (type === "transfer") throw new Error("transfers are proposed by kb_write and settled by kb transfer");
  return JSON.parse(JSON.stringify(props, redactJson));
}
function metricsOf(attrs) {
  return Object.entries(attrs).filter(([k]) => k.startsWith("metric:")).map(([k, [v]]) => {
    const [value2, unit, better, baseline] = v.split("|");
    return { name: k.slice(7), value: Number(value2), unit: unit || void 0, better: better === "lower" ? "lower" : "higher", baseline: baseline ? Number(baseline) : void 0 };
  });
}
var metricAttr = (m) => `${m.value}|${m.unit ?? ""}|${m.better}|${m.baseline ?? ""}`;
function agrees(a, b) {
  const move = (m) => Math.sign((m.value - m.baseline) * (m.better === "lower" ? -1 : 1));
  let verdict = null;
  for (const m of a.metrics) {
    const n = b.metrics.find((x) => x.name === m.name);
    if (!n || m.baseline === void 0 || n.baseline === void 0) continue;
    const sa = move(m), sb = move(n);
    if (!sa || !sb) continue;
    if (sa !== sb) return false;
    verdict = true;
  }
  return verdict;
}
var MAX_PROPOSALS = 12;
function proposeTransfers(db, bankDir, findingId, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const f = must(db, findingId), about = getRels(db, findingId).filter((r) => r.type === "about");
  const concepts2 = about.map((r) => r.dst).filter((d) => kindOfId(d) === "concept");
  const approaches = about.map((r) => r.dst).filter((d) => kindOfId(d) === "approach");
  const keys = new Set(about.flatMap((r) => typeof r.props.facet_key === "string" ? [r.props.facet_key] : []));
  const live2 = `n.kind='approach' AND n.deleted_at IS NULL AND n.project IS NOT NULL AND n.project IS NOT ?`;
  const byConcept = db.sql.prepare(`SELECT DISTINCT r.src AS id FROM rel r JOIN note n ON n.id=r.src WHERE r.dst=? AND r.type IN ('relies_on','about') AND r.deleted_at IS NULL AND ${live2}`);
  const byFacet = db.sql.prepare(`SELECT DISTINCT a.note_id AS id FROM attr a JOIN note n ON n.id=a.note_id WHERE a.key=? AND ${live2}`);
  const candidates = /* @__PURE__ */ new Set();
  for (const c of concepts2) for (const r of byConcept.all(c, f.project).sort((x, y) => x.id.localeCompare(y.id))) candidates.add(r.id);
  for (const k of keys) for (const r of byFacet.all(`facet:${k}`, f.project).sort((x, y) => x.id.localeCompare(y.id))) candidates.add(r.id);
  const existing = new Set(getRels(db, findingId).filter((r) => r.type === "transfer").map((r) => r.dst));
  const made = [];
  for (const dst of [...candidates].slice(0, MAX_PROPOSALS)) {
    if (existing.has(dst) || approaches.includes(dst)) continue;
    const props = { state: "proposed" }, id = relId(findingId, "transfer", dst, props);
    addRel(db, { id, src: findingId, type: "transfer", dst, props, created_at: now, deleted_at: null });
    made.push(id);
  }
  if (made.length) {
    touch2(db, findingId, now);
    exportNote(db, bankDir, findingId);
  }
  return made;
}
function applyProvisionalVerdicts(db, bankDir, findingId, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const g = must(db, findingId);
  if (!g.project) return;
  const concepts2 = getRels(db, findingId).filter((r) => r.type === "about" && kindOfId(r.dst) === "concept").map((r) => r.dst);
  if (!concepts2.length) return;
  const rows = db.sql.prepare(`SELECT DISTINCT t.id, t.src, t.props FROM rel t JOIN note a ON a.id=t.dst JOIN note s ON s.id=t.src AND s.deleted_at IS NULL
    JOIN rel c ON c.src=t.src AND c.type='about' AND c.deleted_at IS NULL
    WHERE t.type='transfer' AND t.deleted_at IS NULL AND t.src<>? AND a.project=? AND c.dst IN (${concepts2.map(() => "?").join(",")}) ORDER BY t.id`).all(findingId, g.project, ...concepts2);
  const mine = { metrics: metricsOf(getAttrs(db, findingId)) };
  const setState = (t, state) => rekeyRel(db, t.id, { props: { ...JSON.parse(t.props), state } });
  const touched = /* @__PURE__ */ new Set();
  for (const t of rows) {
    const state = JSON.parse(t.props).state;
    if (state !== "proposed" && state !== "confirmed_provisional") continue;
    const v = agrees({ metrics: metricsOf(getAttrs(db, t.src)) }, mine);
    if (v === null) continue;
    if (v) {
      if (state === "proposed") {
        setState(t, "confirmed_provisional");
        touched.add(t.src);
      }
      continue;
    }
    if (state === "confirmed_provisional") setState(t, "proposed");
    for (const [x, y] of [[t.src, findingId], [findingId, t.src]]) {
      addRel(db, { id: relId(x, "conflicts_with", y, {}), src: x, type: "conflicts_with", dst: y, props: {}, created_at: now, deleted_at: null });
      setAttrs(db, x, { ...getAttrs(db, x), state: "conflicting" });
    }
    touched.add(t.src);
    touched.add(findingId);
  }
  for (const id of touched) {
    touch2(db, id, now);
    exportNote(db, bankDir, id);
  }
}
function kbWrite(db, bankDir, rec, now = (/* @__PURE__ */ new Date()).toISOString()) {
  if (!WRITABLE_KINDS.includes(rec.kind)) throw new Error(`kb_write writes ${WRITABLE_KINDS.join(", ")}, not ${rec.kind}`);
  const id = rec.id ?? noteId(rec.kind);
  if (kindOfId(id) !== rec.kind) throw new Error(`id ${id} is not a ${rec.kind}`);
  const prev = getNote(db, id), domain = rec.domain ?? prev?.domain ?? null, project = rec.project ?? prev?.project ?? null, facets = rec.facets ?? {};
  if (Object.keys(facets).length) {
    if (rec.kind === "approach") {
      if (!domain) throw new Error("facets need a domain");
      validateApproachFacets(db, domain, facets);
    } else if (rec.kind === "target") {
      const bad = Object.keys(facets).filter((k) => !TARGET_FACETS.includes(k));
      if (bad.length) throw new Error(`a target's facets are environment and subject, not ${bad.join(", ")}`);
    } else throw new Error(`facets belong on an approach or a target, not a ${rec.kind}`);
  }
  const attrs = prev ? getAttrs(db, id) : {};
  for (const [k, v] of Object.entries(rec.attrs ?? {})) attrs[k] = (Array.isArray(v) ? v : [v]).map(red);
  if (attrs.gate) {
    if (!domain) throw new Error("gate needs a domain");
    attrs.gate_rank = [String(gateRank(db, domain, attrs.gate[0]))];
  }
  const rels = (rec.rels ?? []).map((r) => ({ type: r.type, dst: must(db, r.dst).id, props: userRel(r.type, r.props) }));
  upsertNote(db, { id, kind: rec.kind, domain, project, title: red(rec.title), body: red(rec.body ?? prev?.body ?? ""), created_at: prev?.created_at ?? now, updated_at: now, deleted_at: null, device_id: deviceId() });
  for (const [k, v] of Object.entries(facets)) attrs[`facet:${k}`] = [red(v)];
  for (const m of rec.metrics ?? []) attrs[`metric:${m.name}`] = [metricAttr(m)];
  if (rec.method !== void 0) attrs.method = [red(rec.method)];
  if (rec.objective !== void 0) attrs.objective = [red(rec.objective)];
  if (rec.trials !== void 0) attrs.trials = [String(rec.trials)];
  const concepts2 = (rec.tags ?? []).map((tag) => {
    const r = resolveConcept(db, bankDir, tag, now);
    return { tag, conceptId: r.conceptId, how: r.how };
  });
  const rel = (type, dst, props = {}) => addRel(db, { id: relId(id, type, dst, props), src: id, type, dst, props, created_at: now, deleted_at: null });
  for (const c of concepts2) rel("about", c.conceptId);
  for (const r of rels) rel(r.type, r.dst, r.props);
  for (const e of rec.evidence ?? []) {
    const eid = evidenceId(e.sha256 ?? sha2562(`${e.kind}|${e.ref}`));
    if (!getNote(db, eid)) {
      upsertNote(db, { id: eid, kind: "evidence", domain, project, title: red(`${e.kind}: ${e.ref}`), body: "", created_at: now, updated_at: now, deleted_at: null, device_id: deviceId() });
      setAttrs(db, eid, { origin: e.kind, ref: red(e.ref), ...e.sha256 ? { sha256: e.sha256 } : {} });
      exportNote(db, bankDir, eid);
    }
    rel("backed_by", eid);
  }
  if (rec.kind === "finding" && !getRels(db, id).some((r) => r.type === "backed_by")) attrs.state = ["unverified"];
  setAttrs(db, id, attrs);
  exportNote(db, bankDir, id);
  const transfers = rec.kind === "finding" ? proposeTransfers(db, bankDir, id, now) : [];
  if (rec.kind === "finding") applyProvisionalVerdicts(db, bankDir, id, now);
  return { id, created: !prev, concepts: concepts2, transfers, questions: db.sql.prepare("SELECT COUNT(*) AS n FROM pending_merge WHERE resolved IS NULL").get().n };
}
function setTransfer(db, bankDir, transferId, state, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const t = db.sql.prepare(`SELECT src, props FROM rel WHERE id=? AND type='transfer' AND deleted_at IS NULL`).get(transferId);
  if (!t) throw new Error(`no transfer ${transferId}`);
  const next = rekeyRel(db, transferId, { props: { ...JSON.parse(t.props), state } });
  touch2(db, t.src, now);
  exportNote(db, bankDir, t.src);
  return next;
}
function retractNote(db, bankDir, id, now = (/* @__PURE__ */ new Date()).toISOString()) {
  must(db, id);
  softDeleteNote(db, id, now);
  exportNote(db, bankDir, id);
}
function setAttr(db, bankDir, id, key, value2, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const n = must(db, id), attrs = getAttrs(db, id);
  attrs[key] = [red(value2)];
  if (key === "gate") {
    if (!n.domain) throw new Error("gate needs a domain");
    attrs.gate_rank = [String(gateRank(db, n.domain, value2))];
  }
  setAttrs(db, id, attrs);
  touch2(db, id, now);
  exportNote(db, bankDir, id);
}

// src/cli/index.ts
import { readFileSync as readFileSync14 } from "node:fs";

// src/kb/import.ts
var import_yaml3 = __toESM(require_dist(), 1);
import { createHash as createHash4 } from "node:crypto";
import { closeSync as closeSync2, existsSync as existsSync12, openSync as openSync2, readdirSync as readdirSync6, readFileSync as readFileSync13, readSync as readSync2, statSync as statSync6 } from "node:fs";
import os3 from "node:os";
import path15 from "node:path";
var sha2563 = (b) => createHash4("sha256").update(b).digest("hex");
var projectOf = (dir) => {
  const c = loadProjectConfig(dir);
  return { project: c?.project_id ?? path15.basename(dir), domain: c?.domain ?? null };
};
var mdFiles = (dir) => readdirSync6(dir, { recursive: true }).filter((f) => f.endsWith(".md") && statSync6(path15.join(dir, f)).isFile()).sort();
function importSources(db, bankDir, sources, now) {
  let created = 0;
  for (const s of sources) {
    const bytes = readFileSync13(s.file), sha = sha2563(bytes), id = evidenceId(sha);
    if (getNote(db, id)) continue;
    upsertNote(db, { id, kind: "evidence", domain: s.domain, project: s.project, title: redactSensitive(s.title).text, body: redactSensitive(bytes.toString("utf8")).text, created_at: now, updated_at: now, deleted_at: null, device_id: deviceId() });
    setAttrs(db, id, { ...s.attrs, source_path: s.file, sha256: sha });
    exportNote(db, bankDir, id);
    created++;
  }
  return { files: sources.length, created, unchanged: sources.length - created };
}
function serenaDirs(dir, skip, out = []) {
  let entries;
  try {
    entries = readdirSync6(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path15.join(dir, e.name);
    if (!e.isDirectory() || e.name === "node_modules" || e.name === ".git" || p === skip) continue;
    if (e.name === ".serena") {
      if (existsSync12(path15.join(p, "memories"))) out.push(path15.join(p, "memories"));
    } else serenaDirs(p, skip, out);
  }
  return out;
}
function importSerena(db, bankDir, roots, home2 = os3.homedir(), now = (/* @__PURE__ */ new Date()).toISOString()) {
  const sources = [], seen = /* @__PURE__ */ new Set();
  const add = (memDir, owner) => {
    for (const rel of mdFiles(memDir)) {
      const file = path15.join(memDir, rel);
      if (seen.has(file)) continue;
      seen.add(file);
      const name = rel.slice(0, -3).split(path15.sep).join("/");
      sources.push({ file, title: name, ...owner, attrs: { origin: "serena", memory_name: name } });
    }
  };
  const global = path15.join(home2, ".serena", "memories", "global");
  if (existsSync12(global)) add(global, { project: null, domain: null });
  for (const root of roots) for (const memDir of serenaDirs(path15.resolve(root), path15.join(home2, ".cache"))) add(memDir, projectOf(path15.dirname(path15.dirname(memDir))));
  return importSources(db, bankDir, sources, now);
}
function transcriptCwd(projDir) {
  for (const f of readdirSync6(projDir).filter((f2) => f2.endsWith(".jsonl")).sort()) {
    const buf = Buffer.alloc(1 << 20), fd = openSync2(path15.join(projDir, f), "r");
    let n;
    try {
      n = readSync2(fd, buf, 0, buf.length, 0);
    } finally {
      closeSync2(fd);
    }
    for (const line of buf.subarray(0, n).toString("utf8").split("\n")) {
      try {
        const cwd = JSON.parse(line).cwd;
        if (typeof cwd === "string" && cwd) return cwd;
      } catch {
      }
    }
  }
  return null;
}
function resolveDashed(dashed) {
  const enc = (s) => s.replace(/[^A-Za-z0-9]/g, "-");
  const walk = (dir, rest) => {
    if (!rest) return dir;
    let names;
    try {
      names = readdirSync6(dir, { withFileTypes: true }).filter((e) => e.isDirectory() || e.isSymbolicLink()).map((e) => e.name);
    } catch {
      return null;
    }
    for (const name of names.filter((n) => rest === enc(n) || rest.startsWith(enc(n) + "-")).sort((a, b) => b.length - a.length)) {
      const r = walk(path15.join(dir, name), rest.slice(enc(name).length + 1));
      if (r) return r;
    }
    return null;
  };
  return dashed.startsWith("-") ? walk(path15.sep, dashed.slice(1)) : null;
}
function importClaudeMemory(db, bankDir, home2 = os3.homedir(), now = (/* @__PURE__ */ new Date()).toISOString()) {
  const projects = path15.join(home2, ".claude", "projects"), sources = [];
  for (const d of existsSync12(projects) ? readdirSync6(projects).sort() : []) {
    const projDir = path15.join(projects, d), memDir = path15.join(projDir, "memory");
    if (!existsSync12(memDir)) continue;
    const files = readdirSync6(memDir).filter((f) => f.endsWith(".md") && f !== "MEMORY.md" && statSync6(path15.join(memDir, f)).isFile()).sort();
    if (!files.length) continue;
    const cwd = transcriptCwd(projDir) ?? resolveDashed(d), owner = cwd ? projectOf(cwd) : { project: d, domain: null };
    for (const f of files) {
      const file = path15.join(memDir, f), fm = frontmatter(readFileSync13(file, "utf8"));
      const type = fm.metadata?.type ?? fm.type;
      sources.push({
        file,
        title: typeof fm.name === "string" && fm.name ? fm.name : f.slice(0, -3),
        ...owner,
        attrs: { origin: "claude-memory", source_dir: projDir, ...typeof type === "string" ? { origin_type: type } : {} }
      });
    }
  }
  return importSources(db, bankDir, sources, now);
}
function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) return {};
  try {
    const fm = (0, import_yaml3.parse)(m[1]);
    return fm && typeof fm === "object" ? fm : {};
  } catch {
    return {};
  }
}

// src/kb/map.ts
import { mkdirSync as mkdirSync8, writeFileSync as writeFileSync6 } from "node:fs";
import path16 from "node:path";

// src/kb/map-template.ts
var TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Knowledge bank</title>
<style>
:root { color-scheme:dark;
  --paper:#232634; --paper-2:#2d3142; --paper-3:#373b4e; --ink:#f5f5f5; --muted:#bfc0c0; --soft:#8d909b; --rule:#3f4357; --rule-solid:#5b6078;
  --accent:#f08a59; --accent-tint:rgba(240,138,89,.14); --dim:.35;
  --reproduced:#7bd389; --observed:#7aaef5; --unverified:#e6c062; --conflicting:#ef6f6f;
  --sans:system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --serif:"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --mono:ui-monospace, "SF Mono", Menlo, Consolas, monospace; --ease:cubic-bezier(.2,0,0,1); --stagger:25ms; }

* { box-sizing:border-box }
html, body { height:100% }
body { margin:0; background:var(--paper); color:var(--ink); font:14px/1.45 var(--sans); display:grid; grid-template-rows:auto minmax(0,1fr); grid-template-columns:minmax(0,1fr) auto; grid-template-areas:"top top" "board panel"; overflow:hidden }
button { font:inherit; color:inherit; background:none; border:0; padding:0; cursor:pointer; text-align:left }
:focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:6px }
h1, h2, h3, p { margin:0 }
.eyebrow { font:500 11px/1.4 var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--soft) }
code, .id { font:12px/1.4 var(--mono) }

/* top bar */
.top { grid-area:top; display:flex; align-items:center; gap:16px; padding:12px 24px; border-bottom:1px solid var(--rule); background:var(--paper) }
.brand { min-width:0 } .brand .eyebrow { white-space:nowrap; overflow:hidden; text-overflow:ellipsis } .brand h1 { font:400 24px/1.1 var(--serif); letter-spacing:-.01em; margin-top:2px; white-space:nowrap }
.spacer { flex:1 }
#search { width:min(280px, 36vw); padding:8px 12px; border:1px solid var(--rule); border-radius:8px; background:var(--paper-2); color:var(--ink); font:inherit; font-size:13px }
#search::placeholder { color:var(--soft) }
.tool { padding:8px 12px; border:1px solid var(--rule); border-radius:8px; font-size:13px; white-space:nowrap; transition:background .15s, border-color .15s }
.tool:hover { background:var(--paper-2) } .tool[aria-expanded="true"], .tool[aria-pressed="true"] { background:var(--paper-2); border-color:var(--rule-solid) }

/* filters drawer (left, over the board) */
#filters { position:fixed; left:0; top:0; bottom:0; width:288px; z-index:9; background:var(--paper-2); border-right:1px solid var(--rule); overflow:auto; padding:20px 24px 32px; transform:translateX(-100%); transition:transform .25s var(--ease) }
body.filters-open #filters { transform:none }
#scrim { display:none; position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:8 } body.filters-open #scrim { display:block }
#filters .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px } #filters .head h2 { font:400 20px/1.1 var(--serif) }
.close { width:32px; height:32px; border-radius:50%; text-align:center; line-height:30px; font-size:18px; color:var(--muted); transition:background .15s } .close:hover { background:var(--paper-3); color:var(--ink) }
#filters fieldset { border:0; padding:0; margin:0 0 20px } #filters legend { padding:0; margin-bottom:8px }
#filters label { display:flex; gap:10px; align-items:flex-start; padding:4px 0; font-size:13px; cursor:pointer; overflow-wrap:anywhere }
#filters input[type="checkbox"] { margin:2px 0 0; accent-color:var(--accent) }
#filters select { width:100%; margin-top:4px; padding:6px 8px; border:1px solid var(--rule); border-radius:6px; background:var(--paper); color:var(--ink); font:inherit; font-size:13px }
.none { color:var(--soft); font-size:13px }
.legend { display:grid; grid-template-columns:40px 1fr; gap:8px 12px; align-items:center; font-size:13px; color:var(--muted) }
.legend svg { width:40px; height:12px; display:block } .legend .led { display:block; margin:0 auto; opacity:1 }

/* board */
.board { grid-area:board; position:relative; overflow:hidden; touch-action:none; cursor:grab; background:var(--paper) }
.board.dragging { cursor:grabbing; user-select:none } body.space .board { cursor:grab }
.canvas { position:absolute; left:0; top:0; transform-origin:0 0; will-change:transform } .canvas.animate { transition:transform .4s var(--ease) }
.layout { display:grid; grid-template-columns:minmax(232px, 12%) minmax(0,1fr); gap:24px 72px; align-items:start; position:relative; padding:24px 24px 48px }
.zoom { position:absolute; right:16px; bottom:16px; display:flex; gap:2px; z-index:6; background:var(--paper-2); border:1px solid var(--rule); border-radius:8px; padding:4px }
.zoom button { padding:6px 10px; border-radius:6px; font:500 11px/1 var(--mono); letter-spacing:.08em; color:var(--muted); transition:background .15s, color .15s }
.zoom button:hover:not(:disabled) { background:var(--paper-3); color:var(--ink) } .zoom button:disabled { opacity:.35; cursor:default } .zoom .pct { min-width:56px; text-align:center }
/* semantic zoom: zoomed out, the parts shed detail and their names grow, so a title stays readable at any zoom */
/* terse by default: a part shows its name and a row of LEDs; the finding text appears where you drill in (select it), or everywhere with the Text switch */
.findings.dots { display:flex; flex-wrap:wrap; gap:6px; padding:0 12px 10px } .findings.dots > li, .findings.dots > li.hidden-more { display:block }
.findings.dots .badge > span, .findings.dots .more-row, .findings.dots + .loose .eyebrow { display:none } .findings.dots .badge { width:auto; padding:0 } .findings.dots .badge .led { margin:0 }
.loose .findings.dots { padding:4px 4px 0 } body.lod-mid .loose .eyebrow, body.lod-low .loose .eyebrow { display:none }
body.lod-mid .node .part > span { -webkit-line-clamp:2 }
body.lod-low .node .part { font-size:22px; padding:10px 14px } body.lod-low .node .part > span { -webkit-line-clamp:2 } body.lod-low .led { width:12px; height:12px }
body.lod-low .lane h2, body.lod-low .rail h2 { font-size:28px } body.lod-low .lane > header .eyebrow, body.lod-low .stages .eyebrow { font-size:15px } body.lod-low .lane { padding:20px }
body.lod-low .concept { font-size:21px; padding:8px 0 8px 10px } body.lod-low .concept .hub { width:12px; height:12px } body.lod-low .rail .hint, body.lod-low .rail .findings { display:none }
body.lod-low .edge path.vis { stroke-width:2 } body.lod-low .edge.lit path.vis { stroke-width:3 } body.lod-low .edge text { font-size:15px }
body.lod-min .node .part > span, body.lod-min .node .proj, body.lod-min .col .stage, body.lod-min .rail .hint, body.lod-min .rail .findings, body.lod-min .lane > header .eyebrow { display:none }
body.lod-min .node { min-height:36px } body.lod-min .node .part { padding:6px 10px } body.lod-min .findings { padding:0 10px 8px } body.lod-min .led { width:14px; height:14px }
body.lod-min .lane h2, body.lod-min .rail h2 { font-size:64px; line-height:1 } body.lod-min .lane { padding:24px } body.lod-min .concept { font-size:30px; padding:6px 0 6px 10px } body.lod-min .concept .hub { width:16px; height:16px }
body.lod-min .edge path.vis { stroke-width:3 } body.lod-min .edge.lit path.vis { stroke-width:5 }
.rail { background:var(--paper-2); border:1px solid var(--rule); border-radius:10px; padding:16px; min-width:0 }
.rail > header { margin-bottom:12px } .rail h2 { font:600 15px/1.3 var(--sans) } .rail .hint { color:var(--soft); font-size:12px; margin-top:4px }
.rail ul { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:2px 16px; align-items:start }
.concept { display:flex; gap:12px; align-items:center; width:100%; padding:6px 0 6px 8px; border-radius:6px; font-size:13px; line-height:1.35; transition:background .15s, opacity .18s }
.concept:hover, .concept.near { background:var(--paper-3) }
.concept > span:first-child { flex:1; min-width:0; overflow-wrap:anywhere }
.concept .n { color:var(--soft); font:500 11px var(--mono); letter-spacing:.06em; white-space:nowrap }
.concept .hub { flex:none; width:8px; height:8px; border-radius:50%; background:var(--ink); border:1.5px solid var(--ink) }
.concept.hollow .hub { background:transparent } .concept.multi { font-weight:600 }
.rail .findings { padding:0 16px 8px 8px }
.lanes { display:grid; gap:16px; min-width:0 }
.lane { background:var(--paper-2); border:1px solid var(--rule); border-radius:10px; padding:16px; min-width:0 }
.lane > header { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; margin-bottom:12px } .lane h2 { font:600 15px/1.3 var(--sans) }
.cols { display:grid; gap:12px 40px }
.col .parts { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:8px; align-content:start } .col .stage { margin-bottom:8px }
.lane h2 { cursor:pointer } .lane.folded .cols { display:none } .lane.folded h2::after { content:" +"; color:var(--soft) }
.node .proj { display:block; margin-top:4px; font:500 10px/1.2 var(--mono); letter-spacing:.08em; color:var(--soft); font-style:normal } body.lod-mid .node .proj, body.lod-low .node .proj { display:none }
.node { position:relative; border:1px solid var(--rule-solid); border-radius:6px; background:var(--paper); transition:border-color .15s, opacity .18s }
.node[data-kind="target"] { background:transparent; border-style:dashed } .node[data-kind="theme"] { background:var(--paper-3) }
.node:hover, .node.near { border-color:var(--muted) }
.node .part { display:block; width:100%; padding:8px 12px; font-weight:500; font-size:13px; line-height:1.35; border-radius:6px }
.node .part > span, .badge > span { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; overflow-wrap:anywhere }
.findings { list-style:none; margin:0; padding:0 8px 8px }
.findings li.hidden-more { display:none } .expanded > .findings li.hidden-more, li.expanded > .findings li.hidden-more { display:block }
.more { padding:4px 4px 2px 20px; letter-spacing:.08em; color:var(--soft) } .more:hover { color:var(--ink) }
body.quiet .edge:not(.lit):not(.selected) { display:none }
.badge { display:flex; gap:8px; align-items:flex-start; width:100%; padding:4px; border-radius:6px; font-size:12px; line-height:1.35; color:var(--muted); transition:color .15s, opacity .18s }
.badge:hover, .badge.near, .badge.selected { color:var(--ink) }
.badge .led { margin-top:4px }
.led { flex:none; display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--c, var(--soft)); border:1px solid var(--paper-2); opacity:0; transition:opacity .3s ease-out calc(.9s + var(--i,0)*40ms) }
body.ready .led { opacity:1 }
[data-state="reproduced"] .led { --c:var(--reproduced) } [data-state="observed"] .led { --c:var(--observed) }
[data-state="unverified"] .led { --c:var(--unverified) } [data-state="conflicting"] .led { --c:var(--conflicting) }
[data-expired="1"] .led, [data-superseded="1"] .led { background:repeating-linear-gradient(45deg, var(--c) 0 2px, var(--paper-2) 2px 4px); border-color:var(--c) }
.loose { grid-column:1 / -1 } .loose .eyebrow { margin:8px 0 4px }
.empty { grid-column:1 / -1; color:var(--soft); font-size:13px }
.selected { outline:2px solid var(--accent); outline-offset:2px; border-radius:6px }

/* traces: drawn behind the parts */
.wires { position:absolute; left:0; top:0; pointer-events:none; overflow:visible; z-index:2 }
.node, .rail li, .lane > header, .col .stage, .loose .eyebrow, .empty { position:relative; z-index:3 }
.edge path.vis { fill:none; stroke:var(--muted); stroke-width:1.25; stroke-linecap:round; stroke-linejoin:round; opacity:.45; transition:stroke .15s, stroke-width .15s, opacity .18s }
.edge path.hit { fill:none; stroke:transparent; stroke-width:10; pointer-events:stroke; cursor:pointer }
.edge[data-motion="draw"] path.vis { stroke-dasharray:var(--len, 1); stroke-dashoffset:var(--len, 1); transition:stroke-dashoffset .7s var(--ease) calc(.3s + var(--i,0)*var(--stagger)), stroke .15s, stroke-width .15s, opacity .18s }
body.ready .edge[data-motion="draw"] path.vis { stroke-dashoffset:0 }
.edge[data-motion="fade"] { opacity:0; transition:opacity .5s ease-out calc(.4s + var(--i,0)*var(--stagger)) } body.ready .edge[data-motion="fade"] { opacity:1 }
.edge[data-type="discovered_in"] path.vis { stroke-dasharray:2 4 }
.edge[data-type="transfer"] path.vis { stroke-dasharray:5 4 }
.edge[data-type="transfer"][data-state^="confirmed"] path.vis { stroke:var(--ink); stroke-dasharray:none; stroke-width:1.75; opacity:.8 }
.edge[data-type="transfer"][data-state="refuted"] path.vis { opacity:.3 }
.edge[data-type="supersedes"] path.vis { opacity:.2 } .edge[data-type="conflicts_with"] path.vis { stroke:var(--conflicting); stroke-dasharray:1 4 }
.edge text { font:500 10px var(--mono); letter-spacing:.1em; text-transform:uppercase; fill:var(--soft); paint-order:stroke; stroke:var(--paper-2); stroke-width:4px; stroke-linejoin:round }
.edge text.x { font:700 14px var(--sans); letter-spacing:0; fill:var(--conflicting) }
.edge.lit path.vis, .edge:hover path.vis, .edge.selected path.vis, .edge:focus-visible path.vis { stroke:var(--accent); stroke-width:2; opacity:1 }
.edge.lit text, .edge.selected text { fill:var(--accent) }
.edge.selected, .edge:focus-visible { outline:none }
body.focus .edge:not(.lit):not(.selected) { opacity:.12 }
/* while something is lit, the highlighted traces and their gate labels float above the dimmed parts instead of hiding behind them */
body.focus .wires { z-index:4 } body.focus .edge:not(.lit):not(.selected) path.hit { pointer-events:none }
body.dense .edge.lit path.vis { opacity:.55; stroke-width:1.5 } /* a part with dozens of relations: thinner, quieter lines instead of a solid block */
body.focus .node:not(.near):not(.selected):not(:has(.selected)), body.focus .badge:not(.near):not(.selected), body.focus .concept:not(.near):not(.selected) { opacity:var(--dim) }
body.focus .node:has(.badge.near) { opacity:1 }
.dim { opacity:.25 !important }
.off { display:none !important }

/* the one reveal */
.lane, .rail { opacity:0; transform:translateY(8px); transition:opacity .45s var(--ease) calc(var(--i,0)*60ms), transform .45s var(--ease) calc(var(--i,0)*60ms) }
body.ready .lane, body.ready .rail { opacity:1; transform:none }

/* inspector (right, pushes the board) */
#panel { grid-area:panel; width:0; overflow:hidden; border-left:1px solid transparent; background:var(--paper-2); transition:width .25s var(--ease) }
body.panel-open #panel { width:360px; overflow:auto; border-left-color:var(--rule) }
#panel .in { position:relative; width:360px; padding:20px 24px 40px; opacity:0; transform:translateX(8px); transition:opacity .22s var(--ease), transform .22s var(--ease) }
#panel .in.show { opacity:1; transform:none }
#panel .close { position:absolute; right:16px; top:14px }
#panel h2 { font:600 15px/1.35 var(--sans); overflow-wrap:anywhere; margin-right:40px }
#panel .kind { color:var(--muted); margin-top:4px; font-size:13px } #panel .id { color:var(--soft); display:block; margin-top:4px; overflow-wrap:anywhere }
#panel h3 { margin:20px 0 8px; padding-bottom:6px; border-bottom:1px solid var(--rule) }
#panel dl { display:grid; grid-template-columns:max-content minmax(0,1fr); gap:4px 16px; margin:12px 0 0; font-size:13px } #panel dt { color:var(--muted) } #panel dd { margin:0; overflow-wrap:anywhere }
#panel ul { margin:0; padding:0; list-style:none; display:grid; gap:4px; font-size:13px }
#panel li.rel { display:flex; gap:8px; align-items:baseline; padding:6px 8px; margin:0 -8px; border-radius:6px; cursor:pointer; transition:background .15s } #panel li.rel:hover { background:var(--paper-3) }
#panel li.rel .arrow { color:var(--soft); flex:none } #panel li.rel .type { color:var(--muted) } #panel li.rel .props { color:var(--soft); font-size:12px }
.cmd { display:flex; gap:8px; align-items:stretch; margin:8px 0 } .cmd code { flex:1; background:var(--paper); border:1px solid var(--rule); padding:8px 10px; border-radius:6px; overflow-wrap:anywhere; user-select:all }
.cmd button { flex:none; padding:0 12px; border:1px solid var(--rule); border-radius:6px; font-size:12px; min-width:64px; text-align:center; transition:background .15s, color .15s } .cmd button:hover { background:var(--paper-3) }
.cmd button.done { background:var(--accent); color:var(--paper); border-color:var(--accent) }
#panel .placeholder { color:var(--muted); font-size:13px; line-height:1.55; margin-right:40px }
#panel details.proposed { margin-top:20px } #panel details.proposed summary { cursor:pointer; padding-bottom:6px; border-bottom:1px solid var(--rule); list-style:none } #panel details.proposed summary::before { content:"\u25B8 "; color:var(--soft) } #panel details.proposed[open] summary::before { content:"\u25BE " } #panel details.proposed ul { margin-top:8px } #panel .placeholder kbd { font:inherit; color:var(--ink) }

@media (max-width: 1099px) {
  body { grid-template-columns:minmax(0,1fr); grid-template-areas:"top" "board" }
  .layout { grid-template-columns:minmax(0,1fr); gap:16px } .rail { order:2 }
  #panel { position:fixed; left:0; right:0; bottom:0; width:auto; max-height:72vh; overflow:auto; border-left:0; border-top:1px solid var(--rule); border-radius:12px 12px 0 0; z-index:7; transform:translateY(102%); transition:transform .28s var(--ease) }
  body.panel-open #panel { width:auto; transform:none } #panel .in { width:auto; transform:none; padding-bottom:calc(28px + env(safe-area-inset-bottom)) }
}
@media (max-width: 720px) {
  .top { padding:10px 16px; gap:10px } .brand .eyebrow { display:none } .brand h1 { font-size:20px } #search { width:auto; flex:1; min-width:0 }
  .layout { padding:16px 12px 120px } .lanes { gap:12px } .lane { padding:12px } .zoom { bottom:12px; right:12px }
  .cols { grid-template-columns:1fr !important; gap:12px } .col.is-empty { display:none }
  .edge:not(.lit):not(.selected) { display:none } /* on a phone the traces appear for the part you touch, not all at once */
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition:none !important; animation:none !important }
  .lane, .rail, .led { opacity:1; transform:none } .edge[data-motion="draw"] path.vis { stroke-dashoffset:0 } .edge[data-motion="fade"] { opacity:1 }
}
</style>
</head>
<body>
<header class="top">
  <div class="brand"><p class="eyebrow">__META__</p><h1>Knowledge bank</h1></div>
  <span class="spacer"></span>
  <input id="search" type="search" placeholder="Search parts and concepts" aria-label="Search parts and concepts" autocomplete="off">
  <button class="tool" id="filters-toggle" type="button" aria-expanded="false" aria-controls="filters">Filters</button>
  <button class="tool" id="panel-toggle" type="button" aria-pressed="false" aria-controls="panel">Inspector</button>
</header>
<aside id="filters"><div class="head"><h2>Filters</h2><button class="close" type="button" aria-label="Close filters">\xD7</button></div>
__FILTERS__
</aside>
<div id="scrim"></div>
<main class="board" id="board">
<div class="canvas" id="canvas">
<div class="layout">
__BOARD__
</div>
<svg class="wires">__EDGES__</svg>
</div>
<div class="zoom" role="toolbar" aria-label="Zoom"><button id="zoom-out" type="button" aria-label="Zoom out" title="Zoom out (\u2212)">\u2212</button><button class="pct" id="zoom-pct" type="button" title="100% (Shift+0)">100%</button><button id="zoom-in" type="button" aria-label="Zoom in" title="Zoom in (+)">+</button><button id="zoom-fit" type="button" title="Fit everything (Shift+1)">Fit</button><button id="zoom-focus" type="button" title="Fit the selection and its neighbours (Shift+2)" disabled>Focus</button></div>
</main>
<aside id="panel"><div class="in show"><button class="close" type="button" aria-label="Close inspector">\xD7</button><p class="placeholder">Click anything to inspect it. Hover to light its connections.<br><br>Scroll pans \xB7 pinch or <kbd>\u2318</kbd>+scroll zooms \xB7 drag empty space moves \xB7 <kbd>Shift</kbd>+<kbd>1</kbd> fits all \xB7 <kbd>Shift</kbd>+<kbd>2</kbd> fits the selection \xB7 <kbd>Esc</kbd> clears.</p></div></aside>
<script id="data" type="application/json">__DATA__</script>
<script>addEventListener('error', () => document.body.classList.add('ready'));</script>
<script>
(() => {
  const data = JSON.parse(document.getElementById('data').textContent);
  const $ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const byId = (id) => document.querySelector('[data-id="' + CSS.escape(id) + '"]:not(.edge)');
  const board = document.getElementById('board'), canvas = document.getElementById('canvas'), wires = document.querySelector('.wires'), panel = document.getElementById('panel'), body = document.body;
  const edges = $('.edge');
  const adj = new Map();
  for (const e of edges) { const { src, dst } = e.dataset; (adj.get(src) ?? adj.set(src, []).get(src)).push({ e, other: dst }); (adj.get(dst) ?? adj.set(dst, []).get(dst)).push({ e, other: src }); }

  // --- filters ---------------------------------------------------------------------------------------------------------------
  const checked = (name) => new Set($('input[data-filter="' + name + '"]:checked').map((i) => i.value));
  function apply() {
    const dom = checked('domain'), st = checked('state'), axes = { environment: checked('environment'), subject: checked('subject') };
    const gateMin = Number(document.getElementById('gate-min').value), validToday = document.getElementById('valid-today').checked;
    const hasEv = document.getElementById('has-evidence').checked, proposed = document.getElementById('show-proposed').checked;
    const hidden = new Set();
    const axisOk = (el) => Object.keys(axes).every((k) => { const v = el.dataset[k]; return !v || v.split('|').some((x) => axes[k].has(x)); });
    for (const l of $('.lane')) { const off = !dom.has(l.dataset.domain); l.classList.toggle('off', off); if (off) for (const e of $('[data-id]', l)) hidden.add(e.dataset.id); }
    for (const n of $('.node')) { const off = hidden.has(n.dataset.id) || !axisOk(n); n.classList.toggle('off', off); if (off) hidden.add(n.dataset.id); }
    for (const b of $('.badge')) {
      const d = b.dataset;
      const off = hidden.has(d.id) || !dom.has(d.domain) || !st.has(d.state) || Number(d.gateRank) < gateMin || (validToday && d.validToday !== '1')
        || (hasEv && d.evidence !== '1') || !axisOk(b) || (d.attach && hidden.has(d.attach));
      b.classList.toggle('off', off); if (off) hidden.add(d.id);
    }
    for (const e of edges) { const d = e.dataset; e.classList.toggle('off', hidden.has(d.src) || hidden.has(d.dst) || (d.type === 'transfer' && d.state === 'proposed' && !proposed)); }
    body.classList.toggle('quiet', !document.getElementById('show-traces').checked);
    body.classList.toggle('terse', !document.getElementById('show-text').checked);
    presentation(); layout();
  }
  function search(q) {
    q = q.trim().toLowerCase();
    for (const el of $('.node, .badge, .concept')) el.classList.toggle('dim', !!q && !(el.textContent + ' ' + (el.dataset.project || '')).toLowerCase().includes(q));
  }

  // --- traces: orthogonal, rounded elbows, fanned attach points, routed from the measured parts ----------------------------------
  const R = 8;
  // canvas coordinates, measured through whatever transform is on screen at this instant (so a running zoom cannot skew the routing)
  function rect(el) { const c = canvas.getBoundingClientRect(), kk = c.width / canvas.offsetWidth || 1, r = el.getBoundingClientRect(); const l = (r.left - c.left) / kk, t = (r.top - c.top) / kk, w = r.width / kk, h = r.height / kk; return { l, t, r: l + w, b: t + h, w, h, cx: l + w / 2, cy: t + h / 2 }; }
  const visible = (el) => !!el && el.getClientRects().length > 0;
  const sgn = (v) => (v < 0 ? -1 : 1);
  // horizontal \u2192 vertical \u2192 horizontal through x = mx (or straight when the ends share a row)
  function elbowH(p, q, mx) {
    const dy = q[1] - p[1]; if (Math.abs(dy) < 1) return 'M' + p + 'L' + q;
    const r = Math.min(R, Math.abs(dy) / 2, Math.abs(mx - p[0]), Math.abs(q[0] - mx)), sx1 = sgn(mx - p[0]), sx2 = sgn(q[0] - mx), sy = sgn(dy);
    return 'M' + p + 'H' + (mx - sx1 * r) + 'Q' + [mx, p[1]] + ' ' + [mx, p[1] + sy * r] + 'V' + (q[1] - sy * r) + 'Q' + [mx, q[1]] + ' ' + [mx + sx2 * r, q[1]] + 'H' + q[0];
  }
  // vertical \u2192 horizontal \u2192 vertical through y = my
  function elbowV(p, q, my) {
    const dx = q[0] - p[0]; if (Math.abs(dx) < 1) return 'M' + p + 'L' + q;
    const r = Math.min(R, Math.abs(dx) / 2, Math.abs(my - p[1]), Math.abs(q[1] - my)), sy1 = sgn(my - p[1]), sy2 = sgn(q[1] - my), sx = sgn(dx);
    return 'M' + p + 'V' + (my - sy1 * r) + 'Q' + [p[0], my] + ' ' + [p[0] + sx * r, my] + 'H' + (q[0] - sx * r) + 'Q' + [q[0], my] + ' ' + [q[0], my + sy2 * r] + 'V' + q[1];
  }
  let drawn = false;
  function layout() {
    wires.setAttribute('width', canvas.offsetWidth); wires.setAttribute('height', canvas.offsetHeight);
    wires.style.width = canvas.offsetWidth + 'px'; wires.style.height = canvas.offsetHeight + 'px';
    const lanesEl = board.querySelector('.lanes'), railEl = board.querySelector('.rail');
    const lanesR = rect(lanesEl), railR = railEl && visible(railEl) ? rect(railEl) : null, hubs = $('.concept');
    const busOk = !!railR && lanesR.l >= railR.r + 40;
    const items = [];
    for (const e of edges) {
      let a = byId(e.dataset.src), b = byId(e.dataset.dst);
      const ok = !e.classList.contains('off') && visible(a) && visible(b);
      if (!ok) { e.style.display = 'none'; continue; }
      if (a.classList.contains('concept') && !b.classList.contains('concept')) [a, b] = [b, a]; // part first, concept second
      const A = rect(a), B = rect(b), toConcept = b.classList.contains('concept') && !a.classList.contains('concept');
      const overlapX = Math.min(A.r, B.r) - Math.max(A.l, B.l) > 0, apart = B.t >= A.b - 2 || A.t >= B.b - 2;
      let kind, sa, sb;
      if (toConcept && busOk) { kind = 'bus'; sa = 'left'; sb = 'right'; }
      else if (B.l >= A.r + 8) { kind = 'h'; sa = 'right'; sb = 'left'; }
      else if (A.l >= B.r + 8) { kind = 'h'; sa = 'left'; sb = 'right'; }
      else if (overlapX && apart && Math.abs(B.cy - A.cy) > 24) { kind = 'bracket'; sa = 'right'; sb = 'right'; }
      else if (apart) { kind = 'v'; sa = B.t >= A.b - 2 ? 'bottom' : 'top'; sb = sa === 'bottom' ? 'top' : 'bottom'; }
      else { e.style.display = 'none'; continue; } // one part sits inside the other (an LED on its own part): the mounting shows the relation
      e.style.display = '';
      items.push({ e, a, b, A, B, kind, sa, sb, hub: toConcept ? hubs.indexOf(b) : -1 });
    }
    // fan: every connector on a shared edge gets its own attach point, ordered by where the other end is so fans do not cross
    const groups = new Map();
    const put = (el, side, it, end) => { const k = el.dataset.id + '|' + side; (groups.get(k) ?? groups.set(k, []).get(k)).push({ it, end }); };
    for (const it of items) { put(it.a, it.sa, it, 'A'); put(it.b, it.sb, it, 'B'); }
    for (const [k, list] of groups) {
      const side = k.split('|')[1], horizontal = side === 'left' || side === 'right';
      const other = (p) => { const O = p.end === 'A' ? p.it.B : p.it.A; return horizontal ? O.cy : O.cx; };
      list.sort((p, q) => other(p) - other(q));
      list.forEach((p, i) => {
        const S = p.end === 'A' ? p.it.A : p.it.B, t = (i + 1) / (list.length + 1);
        const pt = side === 'left' ? [S.l, S.t + S.h * t] : side === 'right' ? [S.r, S.t + S.h * t] : side === 'top' ? [S.l + S.w * t, S.t] : [S.l + S.w * t, S.b];
        if (p.end === 'A') p.it.p = pt; else p.it.q = pt;
      });
    }
    // parallel routes through the same corridor are offset by 12 px, as many abreast as the corridor holds; beyond that they share a line
    const corridors = new Map();
    const span = (it) => it.kind === 'h' ? Math.abs(it.q[0] - it.p[0]) : it.kind === 'v' ? Math.abs(it.q[1] - it.p[1]) : 40;
    for (const it of items) { if (it.kind === 'bus') continue; const k = it.kind + Math.round(it.kind === 'h' ? (it.p[0] + it.q[0]) / 2 : it.kind === 'v' ? (it.p[1] + it.q[1]) / 2 : Math.max(it.A.r, it.B.r)); (corridors.get(k) ?? corridors.set(k, []).get(k)).push(it); }
    for (const list of corridors.values()) { const abreast = Math.max(1, Math.min(list.length, Math.floor((Math.min(...list.map(span)) - 16) / 12))); list.forEach((it, i) => { it.offset = ((i % abreast) - (abreast - 1) / 2) * 12; }); }
    let i = 0;
    for (const it of items) {
      const { e, p, q } = it; let d, mid;
      if (it.kind === 'bus') {
        const x = lanesR.l - 16 - (it.hub % 4) * 12; d = elbowH(p, q, x); mid = [x, (p[1] + q[1]) / 2];
      } else if (it.kind === 'bracket') {
        const x = Math.max(it.A.r, it.B.r) + 16 + (it.offset || 0), sy = sgn(q[1] - p[1]), r = Math.min(R, Math.abs(q[1] - p[1]) / 2);
        d = 'M' + p + 'H' + (x - r) + 'Q' + [x, p[1]] + ' ' + [x, p[1] + sy * r] + 'V' + (q[1] - sy * r) + 'Q' + [x, q[1]] + ' ' + [x - r, q[1]] + 'H' + q[0]; mid = [x, (p[1] + q[1]) / 2];
      } else if (it.kind === 'h') {
        const mx = (p[0] + q[0]) / 2 + (it.offset || 0); d = elbowH(p, q, mx); mid = [mx, (p[1] + q[1]) / 2];
      } else {
        const my = (p[1] + q[1]) / 2 + (it.offset || 0); d = elbowV(p, q, my); mid = [(p[0] + q[0]) / 2, my];
      }
      for (const path of $('path', e)) path.setAttribute('d', d);
      const vis = e.querySelector('path.vis'); vis.style.setProperty('--len', vis.getTotalLength().toFixed(1));
      const gate = e.querySelector('text.gate'); if (gate) { const end = sgn(q[0] - p[0]); gate.setAttribute('x', q[0] - end * 8); gate.setAttribute('y', q[1] - 8); gate.setAttribute('text-anchor', end > 0 ? 'end' : 'start'); }
      const x = e.querySelector('text.x'); if (x) { x.setAttribute('x', mid[0]); x.setAttribute('y', mid[1] + 5); x.setAttribute('text-anchor', 'middle'); }
      if (!drawn) e.style.setProperty('--i', i++);
    }
    if (!drawn) body.style.setProperty('--stagger', Math.max(6, Math.min(25, 600 / Math.max(1, i))) + 'ms');
  }

  // --- canvas: pan, zoom, fit, semantic zoom ---------------------------------------------------------------------------------------
  let k = 1, tx = 0, ty = 0, lod = 'full', refits = 0, pendingFit = null, suppressClick = false, space = false;
  const pct = document.getElementById('zoom-pct'), focusBtn = document.getElementById('zoom-focus');
  const clamp = (v) => Math.min(3, Math.max(.05, v));
  // four levels with hysteresis: full \u2265 .8, mid \u2265 .5, low \u2265 .3, min below (lane names and card blocks only)
  const lodFor = (z, cur) => { const up = { min: .35, low: .55, mid: .85 }; const level = (t) => (t >= .8 ? 'full' : t >= .5 ? 'mid' : t >= .3 ? 'low' : 'min'); const n = level(z); const order = ['min', 'low', 'mid', 'full']; if (order.indexOf(n) > order.indexOf(cur) && z < (up[cur] ?? 0)) return cur; return n; };
  let lodTimer;
  function applyView(animate) {
    canvas.classList.toggle('animate', !!animate);
    canvas.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
    pct.textContent = Math.round(k * 100) + '%';
    clearTimeout(lodTimer);
    lodTimer = setTimeout(() => { const n = lodFor(k, lod); if (n !== lod) { lod = n; body.classList.toggle('lod-mid', n === 'mid'); body.classList.toggle('lod-low', n === 'low'); body.classList.toggle('lod-min', n === 'min'); presentation(); } else pendingFit = null; }, 80);
  }
  function sizeCanvas() {
    const w0 = Math.max(320, board.clientWidth); canvas.style.width = w0 + 'px';
    if (board.clientWidth < 720) return; // a phone keeps one column and scrolls
    // a whiteboard is landscape: among a few candidate widths pick the one whose shape is closest to 16:9 (card grids reflow, so the height is not monotonic)
    let best = w0, bestScore = Infinity;
    for (const f of [1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6]) { const w = Math.min(9000, Math.round(w0 * f)); canvas.style.width = w + 'px'; const score = Math.abs(canvas.offsetHeight / w - 0.56); if (score < bestScore) { bestScore = score; best = w; } }
    canvas.style.width = best + 'px';
  }
  function zoomAt(f, cx, cy) { pendingFit = null; const b = board.getBoundingClientRect(), px = cx - b.left, py = cy - b.top, nk = clamp(k * f); f = nk / k; tx = px - (px - tx) * f; ty = py - (py - ty) * f; k = nk; applyView(false); }
  function fit(bx, animate, pad, maxK) {
    if (!bx || bx.r <= bx.l || bx.b <= bx.t) return;
    const vw = Math.max(80, board.clientWidth - pad * 2), vh = Math.max(80, board.clientHeight - pad * 2);
    k = clamp(Math.min(vw / (bx.r - bx.l), vh / (bx.b - bx.t), maxK));
    tx = pad + (vw - (bx.r - bx.l) * k) / 2 - bx.l * k; ty = pad + (vh - (bx.b - bx.t) * k) / 2 - bx.t * k;
    applyView(animate);
  }
  function fitAll(animate) { refits = 2; pendingFit = 'all'; fit({ l: 0, t: 0, r: canvas.offsetWidth, b: canvas.offsetHeight }, animate, 16, 1); }
  function bounds(els) { let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity; for (const el of els) { const R = rect(el); l = Math.min(l, R.l); t = Math.min(t, R.t); r = Math.max(r, R.r); b = Math.max(b, R.b); } return isFinite(l) ? { l, t, r, b } : null; }
  function fitSelection(animate) {
    if (!selected) return;
    const els = neighbours(selected, true).filter(visible); if (!els.length) return;
    refits = 2; pendingFit = 'sel'; const bx = bounds(els); fit(bx, animate, 40, 1);
    if (k < 0.5) { // a proposed-transfer web can span the whole board: stay readable and centre on the selection instead
      const self = byId(selected) || els[0], R = rect(self); k = 0.5; tx = board.clientWidth / 2 - R.cx * k; ty = board.clientHeight / 2 - R.cy * k; applyView(animate);
    }
  }
  function refit() { if (!pendingFit || refits-- <= 0) { pendingFit = null; return; } (pendingFit === 'all' ? fitAll : fitSelection)(true); } // a fit may change the level of detail, which changes the sizes: settle in at most two more passes
  // scroll pans, pinch or Cmd/Ctrl+scroll zooms at the cursor (a trackpad pinch arrives as a wheel event with ctrlKey)
  board.addEventListener('wheel', (ev) => { ev.preventDefault(); if (ev.ctrlKey || ev.metaKey) zoomAt(Math.exp(-ev.deltaY * 0.01), ev.clientX, ev.clientY); else { pendingFit = null; tx -= ev.deltaX; ty -= ev.deltaY; applyView(false); } }, { passive: false });
  let gestureK = 1; // Safari sends its own pinch events
  board.addEventListener('gesturestart', (ev) => { ev.preventDefault(); gestureK = k; });
  board.addEventListener('gesturechange', (ev) => { ev.preventDefault(); zoomAt((gestureK * ev.scale) / k, ev.clientX, ev.clientY); });
  // drag on empty space (or anywhere with Space held) pans; two pointers pinch
  const pointers = new Map(); let drag = null, pinch = null;
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  board.addEventListener('pointerdown', (ev) => {
    pointers.set(ev.pointerId, ev);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()], bl = board.getBoundingClientRect(); const mx = (a.clientX + b.clientX) / 2 - bl.left, my = (a.clientY + b.clientY) / 2 - bl.top; pinch = { d: dist(a, b), k, px: (mx - tx) / k, py: (my - ty) / k }; drag = null; board.classList.remove('dragging'); return; }
    if (ev.button !== 0 || ev.target.closest('.zoom')) return;
    if (ev.target.closest('[data-id], button, input, select, a') && !space) return;
    drag = { x: ev.clientX, y: ev.clientY, tx, ty, moved: false }; board.classList.add('dragging'); board.setPointerCapture(ev.pointerId);
  });
  board.addEventListener('pointermove', (ev) => {
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, ev);
    if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()], bl = board.getBoundingClientRect(); const mx = (a.clientX + b.clientX) / 2 - bl.left, my = (a.clientY + b.clientY) / 2 - bl.top; k = clamp(pinch.k * dist(a, b) / pinch.d); tx = mx - pinch.px * k; ty = my - pinch.py * k; applyView(false); return; }
    if (!drag) return; const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; if (Math.hypot(dx, dy) > 3) { drag.moved = true; pendingFit = null; } tx = drag.tx + dx; ty = drag.ty + dy; applyView(false);
  });
  const endPointer = (ev) => { pointers.delete(ev.pointerId); if (pointers.size < 2) pinch = null; if (drag) { if (drag.moved) suppressClick = true; drag = null; board.classList.remove('dragging'); } };
  board.addEventListener('pointerup', endPointer); board.addEventListener('pointercancel', endPointer);
  document.getElementById('zoom-in').addEventListener('click', () => { const b = board.getBoundingClientRect(); zoomAt(1.25, b.left + b.width / 2, b.top + b.height / 2); });
  document.getElementById('zoom-out').addEventListener('click', () => { const b = board.getBoundingClientRect(); zoomAt(0.8, b.left + b.width / 2, b.top + b.height / 2); });
  pct.addEventListener('click', () => { const b = board.getBoundingClientRect(); zoomAt(1 / k, b.left + b.width / 2, b.top + b.height / 2); });
  document.getElementById('zoom-fit').addEventListener('click', () => fitAll(true));
  focusBtn.addEventListener('click', () => fitSelection(true));

  // --- presentation: LEDs as dots unless you drill in -----------------------------------------------------------------------------
  function presentation() {
    const terse = body.classList.contains('terse');
    for (const f of $('.findings')) { const box = f.closest('.node, .rail li, .loose'); f.classList.toggle('dots', lod !== 'full' || (terse && !(box && box.classList.contains('drill')))); }
  }

  // --- neighbourhood highlight --------------------------------------------------------------------------------------------------
  let selected = null;
  function neighbours(id, strong = false) { // strong: skip proposed transfers, which are suggestions rather than established links
    const out = new Set(); const self = byId(id); if (self) out.add(self);
    for (const { e, other } of adj.get(id) ?? []) { if (strong && e.dataset.type === 'transfer' && e.dataset.state === 'proposed') continue; const o = byId(other); if (o) out.add(o); }
    const edge = edges.find((e) => e.dataset.id === id); if (edge) for (const k of ['src', 'dst']) { const o = byId(edge.dataset[k]); if (o) out.add(o); }
    return [...out];
  }
  function highlight(id, expand = false) { // a selection may unfold collapsed findings; a hover never shifts the layout
    for (const el of $('.near, .lit')) el.classList.remove('near', 'lit');
    body.classList.toggle('focus', !!id);
    if (!id) return;
    const self = byId(id); if (self) self.classList.add('near');
    for (const { e, other } of adj.get(id) ?? []) { e.classList.add('lit'); const o = byId(other); if (o) o.classList.add('near'); }
    // only a selected finding unfolds its row; a selected part keeps its +N more
    if (expand) for (const b of $('.badge.selected')) { const li = b.closest('li.hidden-more'); if (li) { const box = li.parentElement.parentElement; box.classList.add('expanded'); const m = box.querySelector('.more'); if (m) m.textContent = 'fewer'; } }
    body.classList.toggle('dense', $('.edge.lit').length > 12);
    const edge = edges.find((e) => e.dataset.id === id);
    if (edge) { edge.classList.add('lit'); for (const k of ['src', 'dst']) { const o = byId(edge.dataset[k]); if (o) o.classList.add('near'); } }
  }

  // --- inspector -----------------------------------------------------------------------------------------------------------------
  const panelBtn = document.getElementById('panel-toggle');
  function openPanel(open) { body.classList.toggle('panel-open', open); panelBtn.setAttribute('aria-pressed', String(open)); }
  const metric = (k, vs) => { if (!k.startsWith('metric:')) return null; const [v, unit, better, base] = vs[0].split('|'); return k.slice(7) + ' ' + v + (unit ? ' ' + unit : '') + (better ? ', ' + better + ' is better' : '') + (base ? ', baseline ' + base : ''); };
  function show(id) {
    const it = data.items[id]; if (!it) return;
    for (const e of $('.selected')) e.classList.remove('selected');
    const el = document.querySelector('[data-id="' + CSS.escape(id) + '"]'); if (el) el.classList.add('selected');
    for (const d of $('.drill')) d.classList.remove('drill');
    const host = el && !el.classList.contains('edge') ? el.closest('.node, .rail li, .loose') : null; if (host) host.classList.add('drill');
    selected = id; highlight(id, true); presentation();
    const box = document.createElement('div'); box.className = 'in';
    const add = (tag, text, cls, parent = box) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; parent.appendChild(e); return e; };
    const close = add('button', '\xD7', 'close'); close.type = 'button'; close.setAttribute('aria-label', 'Close inspector'); close.onclick = clear;
    add('h2', it.title); add('p', it.kind + (it.domain ? ' in ' + it.domain : '') + (it.project ? ', project ' + it.project : ''), 'kind'); add('span', it.id, 'id');
    const attrs = Object.entries(it.attrs);
    if (attrs.length) { const dl = add('dl'); for (const [k, vs] of attrs) { const m = metric(k, vs); add('dt', m ? 'metric' : k.replace(/^facet:/, ''), null, dl); add('dd', m ?? vs.join(', '), null, dl); } }
    if (it.evidence.length) { add('h3', 'Evidence', 'eyebrow'); const ul = add('ul'); for (const e of it.evidence) add('li', e, null, ul); }
    if (it.rels.length) {
      const isProposed = (r) => r.type === 'transfer' && /"state":"proposed"/.test(r.props || ''), strong = it.rels.filter((r) => !isProposed(r)), proposed = it.rels.filter(isProposed);
      const row = (r, parent) => { const li = add('li', null, 'rel', parent); add('span', r.dir === 'out' ? '\u2192' : '\u2190', 'arrow', li); const t = add('span', null, null, li); add('span', r.type.replace(/_/g, ' ') + ' ', 'type', t); t.appendChild(document.createTextNode(r.other)); if (r.props && !isProposed(r)) add('span', ' ' + r.props, 'props', t); li.onclick = () => show(r.otherId); };
      if (strong.length) { add('h3', 'Relations', 'eyebrow'); const ul = add('ul'); for (const r of strong) row(r, ul); }
      if (proposed.length) { const d = add('details', null, 'proposed'); add('summary', proposed.length + ' proposed transfer' + (proposed.length === 1 ? '' : 's') + ' \u2014 suggestions to confirm or refute', 'eyebrow', d); const ul = add('ul', null, null, d); for (const r of proposed) row(r, ul); }
    }
    if (it.commands.length) {
      add('h3', 'Commands', 'eyebrow');
      for (const c of it.commands) { const row = add('div', null, 'cmd'); add('code', c, null, row); const b = add('button', 'Copy', null, row); b.type = 'button';
        b.onclick = async () => { try { await navigator.clipboard.writeText(c); b.textContent = 'Copied'; b.classList.add('done'); setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('done'); }, 1200); } catch { b.textContent = 'Select and copy'; } }; }
    }
    const old = panel.querySelector('.in'); if (old) old.remove();
    panel.appendChild(box); requestAnimationFrame(() => box.classList.add('show'));
    openPanel(true); panel.scrollTop = 0; focusBtn.disabled = false;
    setTimeout(() => fitSelection(true), 280); // after the inspector has made room
  }
  const placeholder = panel.querySelector('.in');
  function clear() {
    for (const e of $('.selected')) e.classList.remove('selected');
    selected = null; highlight(null); openPanel(false); focusBtn.disabled = true;
    for (const d of $('.drill')) d.classList.remove('drill'); presentation();
    const cur = panel.querySelector('.in'); if (cur !== placeholder) { if (cur) cur.remove(); panel.appendChild(placeholder); }
  }

  // --- wiring ----------------------------------------------------------------------------------------------------------------------
  const target = (ev) => ev.target.closest && ev.target.closest('[data-id]');
  document.addEventListener('click', (ev) => {
    if (suppressClick) { suppressClick = false; return; }
    const laneTitle = ev.target.closest && ev.target.closest('.lane > header h2'); if (laneTitle) { laneTitle.closest('.lane').classList.toggle('folded'); return; }
    const more = ev.target.closest && ev.target.closest('.more');
    if (more) { const box = more.closest('.node, li'); const open = box.classList.toggle('expanded'); more.textContent = open ? 'fewer' : more.dataset.label; return; }
    const t = target(ev); if (t) { show(t.dataset.id); return; } if (ev.target.closest('#panel, #filters, .top')) return; if (selected) clear();
  });
  for (const m of $('.more')) m.dataset.label = m.textContent;
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { if (body.classList.contains('filters-open')) setFilters(false); else clear(); return; }
    const typing = ev.target.matches && ev.target.matches('input, select, textarea');
    if (ev.key === ' ' && !typing && !target(ev)) { ev.preventDefault(); space = true; body.classList.add('space'); return; }
    if (!typing && ev.shiftKey && ev.key === '!') { ev.preventDefault(); fitAll(true); return; } // Shift+1
    if (!typing && ev.shiftKey && ev.key === '@') { ev.preventDefault(); fitSelection(true); return; } // Shift+2
    if (!typing && ev.shiftKey && ev.key === ')') { ev.preventDefault(); pct.click(); return; } // Shift+0
    if (!typing && (ev.key === '+' || ev.key === '=')) { ev.preventDefault(); document.getElementById('zoom-in').click(); return; }
    if (!typing && (ev.key === '-' || ev.key === '_')) { ev.preventDefault(); document.getElementById('zoom-out').click(); return; }
    if (ev.key !== 'Enter' && ev.key !== ' ') return; const t = target(ev); if (t && t.classList.contains('edge')) { ev.preventDefault(); show(t.dataset.id); }
  });
  document.addEventListener('keyup', (ev) => { if (ev.key === ' ') { space = false; body.classList.remove('space'); } });
  board.addEventListener('pointerover', (ev) => { const t = target(ev); if (t) highlight(t.dataset.id); });
  board.addEventListener('pointerout', (ev) => { const t = target(ev); if (t && !(ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest('[data-id]') === t)) highlight(selected); });
  board.addEventListener('focusin', (ev) => { const t = target(ev); if (t) highlight(t.dataset.id); });
  board.addEventListener('focusout', () => highlight(selected));
  panel.querySelector('.close').addEventListener('click', clear);
  panelBtn.addEventListener('click', () => openPanel(!body.classList.contains('panel-open')));
  for (const i of $('#filters input, #filters select')) i.addEventListener('change', apply);
  document.getElementById('search').addEventListener('input', (ev) => search(ev.target.value));
  const filtersBtn = document.getElementById('filters-toggle');
  function setFilters(open) { body.classList.toggle('filters-open', open); filtersBtn.setAttribute('aria-expanded', String(open)); }
  filtersBtn.addEventListener('click', () => setFilters(!body.classList.contains('filters-open')));
  document.getElementById('scrim').addEventListener('click', () => setFilters(false));
  document.querySelector('#filters .close').addEventListener('click', () => setFilters(false));
  new ResizeObserver(() => { layout(); refit(); }).observe(board.querySelector('.layout'));
  addEventListener('resize', () => { sizeCanvas(); layout(); });
  $('.lane, .rail').forEach((el, i) => el.style.setProperty('--i', i));
  $('.led').forEach((el, i) => el.style.setProperty('--i', i));
  sizeCanvas();
  apply();
  if (board.clientWidth >= 720) fitAll(false); else applyView(false); // a phone starts at 100% and pinches from there
  requestAnimationFrame(() => requestAnimationFrame(() => { body.classList.add('ready'); setTimeout(() => { drawn = true; }, 1500); }));
})();
</script>
</body>
</html>
`;

// src/kb/map.ts
var COLUMNS = ["theme", "approach", "experiment", "target"];
var COL_W = 220;
var ROW_H = 28;
var NODE_W = 170;
var BADGE_STEP = 14;
var HEADER = 28;
var LANE_PAD = 50;
var LANE_GAP = 12;
var CONCEPT_COL = 4;
var NO_DOMAIN = "(no domain)";
var colX = (c) => c * COL_W;
var axes = (attrs) => ({ environment: attrs["facet:environment"] ?? [], subject: attrs["facet:subject"] ?? [] });
var liveNotes = (db, kinds) => db.sql.prepare(`SELECT * FROM note WHERE kind IN (${kinds.map(() => "?").join(",")}) AND deleted_at IS NULL ORDER BY created_at, id`).all(...kinds);
function graphData(db, today = /* @__PURE__ */ new Date()) {
  const todayStr = today.toISOString().slice(0, 10);
  const liveIds = new Set(db.sql.prepare("SELECT id FROM note WHERE deleted_at IS NULL").all().map((r) => r.id));
  const rels = db.sql.prepare("SELECT * FROM rel WHERE deleted_at IS NULL ORDER BY created_at, id").all().map((r) => ({ ...r, props: JSON.parse(r.props) })).filter((r) => liveIds.has(r.src) && liveIds.has(r.dst));
  const outOf = (id, type) => rels.filter((r) => r.src === id && r.type === type);
  const laneNotes = liveNotes(db, COLUMNS), findingNotes = liveNotes(db, ["finding"]), conceptNotes = liveNotes(db, ["concept"]);
  const laneNoteIds = new Set(laneNotes.map((n) => n.id)), conceptIds2 = new Set(conceptNotes.map((n) => n.id));
  const attachOf = (f) => {
    const about = outOf(f.id, "about").map((r) => r.dst);
    return about.find((d) => laneNoteIds.has(d)) ?? about.find((d) => conceptIds2.has(d)) ?? null;
  };
  const laneOf = (n) => n.domain ?? NO_DOMAIN;
  const loose = /* @__PURE__ */ new Map();
  for (const f of findingNotes) if (!attachOf(f)) (loose.get(laneOf(f)) ?? loose.set(laneOf(f), []).get(laneOf(f))).push(f);
  const domains = [.../* @__PURE__ */ new Set([...liveNotes(db, ["domain"]).map((d) => d.domain ?? d.title), ...laneNotes.map(laneOf), ...findingNotes.map(laneOf)])].sort();
  const node = (n, x, y) => {
    const attrs = getAttrs(db, n.id);
    return { id: n.id, kind: n.kind, title: n.title, domain: n.domain, project: n.project, attrs, x, y, ...axes(attrs) };
  };
  const nodeById = /* @__PURE__ */ new Map(), looseRow = /* @__PURE__ */ new Map();
  const lanes = [];
  let top = HEADER;
  for (const domain of domains) {
    const columns = { theme: [], approach: [], experiment: [], target: [] }, offset = top + LANE_PAD;
    for (const n of laneNotes.filter((n2) => laneOf(n2) === domain)) {
      const col = columns[n.kind];
      const nd = node(n, colX(COLUMNS.indexOf(n.kind)), offset + col.length * ROW_H);
      col.push(nd);
      nodeById.set(nd.id, nd);
    }
    const nodeRows = Math.max(1, ...COLUMNS.map((c) => columns[c].length)), rows = nodeRows + (loose.get(domain)?.length ?? 0);
    looseRow.set(domain, offset + nodeRows * ROW_H);
    const height = LANE_PAD + rows * ROW_H;
    lanes.push({ domain, columns, top, height });
    top += height + LANE_GAP;
  }
  const pending = db.sql.prepare("SELECT id FROM pending_merge WHERE resolved IS NULL AND (a=? OR b=?) ORDER BY created_at, id");
  const concepts2 = conceptNotes.map((c, i) => {
    const touching = rels.filter((r) => r.dst === c.id && (r.type === "about" || r.type === "relies_on")).map((r) => getNote(db, r.src)?.domain ?? NO_DOMAIN);
    return { ...node(c, colX(CONCEPT_COL), HEADER + LANE_PAD + i * ROW_H), lanes: new Set(touching).size, pending: pending.get(c.id, c.id)?.id ?? null };
  });
  const conceptById = new Map(concepts2.map((c) => [c.id, c]));
  const perAnchor = /* @__PURE__ */ new Map(), looseUsed = /* @__PURE__ */ new Map();
  const findings = findingNotes.map((f) => {
    const attach = attachOf(f), attrs = getAttrs(db, f.id), from = attrs.valid_from?.[0]?.slice(0, 10), to = attrs.valid_to?.[0]?.slice(0, 10);
    let x, y;
    if (attach) {
      const a = nodeById.get(attach) ?? conceptById.get(attach), k = perAnchor.get(attach) ?? 0;
      perAnchor.set(attach, k + 1);
      x = conceptById.has(attach) ? a.x - 10 - k * BADGE_STEP : a.x + NODE_W + 8 + k * BADGE_STEP;
      y = a.y;
    } else {
      const d = laneOf(f), k = looseUsed.get(d) ?? 0;
      looseUsed.set(d, k + 1);
      x = colX(1) + 8;
      y = looseRow.get(d) + k * ROW_H;
    }
    const targets = outOf(f.id, "validated_in").map((r) => nodeById.get(r.dst)).filter((t) => !!t);
    return {
      id: f.id,
      kind: f.kind,
      title: f.title,
      domain: f.domain,
      project: f.project,
      attrs,
      x,
      y,
      attach,
      environment: [...new Set(targets.flatMap((t) => t.environment))],
      subject: [...new Set(targets.flatMap((t) => t.subject))],
      state: attrs.state?.[0] ?? "unverified",
      gateRank: Number(attrs.gate_rank?.[0] ?? -1),
      validToday: (!from || from <= todayStr) && (!to || to >= todayStr),
      expired: !!to && to < todayStr,
      superseded: rels.some((r) => r.type === "supersedes" && r.dst === f.id),
      evidence: outOf(f.id, "backed_by").map((r) => getNote(db, r.dst)?.title ?? r.dst)
    };
  });
  const drawn = /* @__PURE__ */ new Set([...nodeById.keys(), ...conceptById.keys(), ...findings.map((b) => b.id)]);
  const edges = rels.filter((r) => drawn.has(r.src) && drawn.has(r.dst)).map(({ id, type, src, dst, props }) => ({ id, type, src, dst, props }));
  const gates = [];
  for (const r of db.sql.prepare(`SELECT DISTINCT key, value FROM attr WHERE key LIKE 'gate:%'`).all()) {
    const i = Number(r.key.slice(5));
    if (!Number.isInteger(i)) continue;
    gates[i] = gates[i] ? gates[i].split(" / ").includes(r.value) ? gates[i] : `${gates[i]} / ${r.value}` : r.value;
  }
  return { lanes, concepts: concepts2, findings, edges, gates: Array.from(gates, (g) => g ?? "") };
}
var esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
var attr = (k, v) => ` ${k}="${esc(v)}"`;
var list = (k, vs) => vs.length ? attr(k, vs.join("|")) : "";
var flag2 = (b) => b ? "1" : "0";
var SHOW = 2;
var QUIET_ABOVE = 60;
var LABEL = { theme: "Theme", approach: "Approach", experiment: "Experiment", target: "Target" };
var plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
function titlesOf(g) {
  const titles = /* @__PURE__ */ new Map();
  for (const l of g.lanes) for (const c of COLUMNS) for (const n of l.columns[c]) titles.set(n.id, n.title);
  for (const n of [...g.concepts, ...g.findings]) titles.set(n.id, n.title);
  return titles;
}
function renderBoard(g) {
  const byAttach = /* @__PURE__ */ new Map(), loose = /* @__PURE__ */ new Map();
  for (const b of g.findings) {
    const m = b.attach ? byAttach : loose, k = b.attach ?? (b.domain ?? NO_DOMAIN);
    (m.get(k) ?? m.set(k, []).get(k)).push(b);
  }
  const badge = (b) => `<li><button class="badge" type="button"${attr("data-id", b.id)}${attr("data-state", b.state)}${attr("data-domain", b.domain ?? NO_DOMAIN)}${attr("data-gate-rank", b.gateRank)}${attr("data-valid-today", flag2(b.validToday))}${attr("data-evidence", flag2(b.evidence.length > 0))}${attr("data-expired", flag2(b.expired))}${attr("data-superseded", flag2(b.superseded))}${b.attach ? attr("data-attach", b.attach) : ""}${list("data-environment", b.environment)}${list("data-subject", b.subject)}${attr("title", `${b.title} (${b.state})`)}><i class="led"></i><span>${esc(b.title)}</span></button></li>`;
  const findings = (bs) => bs.length ? `<ul class="findings">${bs.map((b, i) => i < SHOW ? badge(b) : badge(b).replace("<li>", '<li class="hidden-more">')).join("")}${bs.length > SHOW ? `<li class="more-row"><button class="more eyebrow" type="button">+${bs.length - SHOW} more</button></li>` : ""}</ul>` : "";
  const node = (n) => `<div class="node"${attr("data-id", n.id)}${attr("data-kind", n.kind)}${n.project ? attr("data-project", n.project) : ""}${list("data-environment", n.environment)}${list("data-subject", n.subject)}><button class="part" type="button"${attr("title", n.title)}><span>${esc(n.title)}</span>${n.project ? `<em class="proj">${esc(n.project)}</em>` : ""}</button>${findings(byAttach.get(n.id) ?? [])}</div>`;
  const used = COLUMNS.filter((c) => g.lanes.some((l) => l.columns[c].length));
  const template = (l) => used.map((c) => `minmax(0,${Math.max(0.6, Math.sqrt(l.columns[c].length)).toFixed(2)}fr)`).join(" ") || "1fr";
  const out = ['<aside class="rail"><header><h2>Concepts</h2><p class="hint">Shared across domains. Bold: two or more domains. Hollow: merge pending.</p></header><ul>'];
  for (const c of g.concepts) out.push(`<li><button class="concept${c.lanes >= 2 ? " multi" : ""}${c.pending ? " hollow" : ""}" type="button"${attr("data-id", c.id)}${attr("data-lanes", c.lanes)}${attr("data-pending", flag2(!!c.pending))}><span>${esc(c.title)}</span>${c.lanes >= 2 ? `<span class="n">${c.lanes}\xD7</span>` : ""}<i class="hub"></i></button>${findings(byAttach.get(c.id) ?? [])}</li>`);
  if (!g.concepts.length) out.push('<li class="none">No concepts yet. Tags on findings become concepts.</li>');
  out.push("</ul></aside>", '<div class="lanes">');
  for (const l of g.lanes) {
    const parts = COLUMNS.reduce((n, c) => n + l.columns[c].length, 0), findings2 = g.findings.filter((b) => (b.domain ?? NO_DOMAIN) === l.domain).length, lo = loose.get(l.domain) ?? [];
    out.push(`<section class="lane"${attr("data-domain", l.domain)}><header><h2 title="Fold or unfold this domain">${esc(l.domain)}</h2><span class="eyebrow">${plural(parts, "part")} \xB7 ${plural(findings2, "finding")}</span></header><div class="cols" style="grid-template-columns:${template(l)}">`);
    for (const c of used) {
      const ns = l.columns[c];
      out.push(`<div class="col${ns.length ? "" : " is-empty"}"${attr("data-col", c)}><h3 class="eyebrow stage">${LABEL[c]}</h3><div class="parts">${ns.map(node).join("")}</div></div>`);
    }
    if (lo.length) out.push(`<div class="loose"><h3 class="eyebrow">Unattached</h3><ul class="findings">${lo.map(badge).join("")}</ul></div>`);
    if (!parts && !lo.length) out.push('<p class="empty">Nothing here yet.</p>');
    out.push("</div></section>");
  }
  out.push("</div>");
  return out.join("\n");
}
function renderEdges(g) {
  const titles = titlesOf(g);
  return g.edges.map((e) => {
    const state = typeof e.props.state === "string" ? e.props.state : "", gate = typeof e.props.gate === "string" ? e.props.gate : "";
    const patterned = e.type === "discovered_in" || e.type === "conflicts_with" || e.type === "transfer" && state !== "confirmed";
    return `<g class="edge"${attr("data-id", e.id)}${attr("data-type", e.type)}${attr("data-src", e.src)}${attr("data-dst", e.dst)}${state ? attr("data-state", state) : ""}${gate ? attr("data-gate", gate) : ""}${attr("data-motion", patterned ? "fade" : "draw")} tabindex="0" role="button"><path class="vis"></path><path class="hit"></path>` + (e.type === "validated_in" && gate ? `<text class="gate">${esc(gate)}</text>` : "") + (e.type === "transfer" && state === "refuted" ? '<text class="x">\xD7</text>' : "") + `<title>${esc(`${e.type}: ${titles.get(e.src) ?? e.src} \u2192 ${titles.get(e.dst) ?? e.dst}`)}</title></g>`;
  }).join("\n");
}
function renderFilters(g) {
  const box = (name, v, label = v, checked = true) => `<label><input type="checkbox"${attr("data-filter", name)}${attr("value", v)}${checked ? " checked" : ""}> ${esc(label)}</label>`;
  const group = (legend, name, values, on = () => true) => `<fieldset><legend class="eyebrow">${legend}</legend>${values.length ? values.map((v) => box(name, v, v, on(v))).join("") : '<div class="none">none</div>'}</fieldset>`;
  const targets = g.lanes.flatMap((l) => l.columns.target);
  const distinct = (xs) => [...new Set(xs)].sort();
  const states = distinct(["unverified", "observed", "reproduced", "conflicting", ...g.findings.map((b) => b.state)]);
  const used = new Set(g.lanes.filter((l) => COLUMNS.some((c) => l.columns[c].length) || g.findings.some((b) => (b.domain ?? NO_DOMAIN) === l.domain)).map((l) => l.domain));
  return [
    group("Domain", "domain", g.lanes.map((l) => l.domain), (d) => used.has(d)),
    group("Environment", "environment", distinct(targets.flatMap((t) => t.environment))),
    group("Subject", "subject", distinct(targets.flatMap((t) => t.subject))),
    group("State", "state", states),
    `<fieldset><legend class="eyebrow">Gate \u2265</legend><select id="gate-min"><option value="-1">any</option>${g.gates.map((name, i) => `<option value="${i}">${esc(`${i}: ${name}`)}</option>`).join("")}</select></fieldset>`,
    `<fieldset><legend class="eyebrow">Findings</legend><label><input type="checkbox" id="valid-today"> valid today</label><label><input type="checkbox" id="has-evidence"> has evidence</label><label><input type="checkbox" id="show-proposed" checked> show proposed transfers</label></fieldset>`,
    `<fieldset><legend class="eyebrow">Detail</legend><label><input type="checkbox" id="show-text"> finding text on every part (otherwise only where you drill in)</label><label><input type="checkbox" id="show-traces"${g.edges.length <= QUIET_ABOVE ? " checked" : ""}> every trace at rest (${g.edges.length}); otherwise traces follow your hover or selection</label></fieldset>`,
    `<fieldset><legend class="eyebrow">Legend</legend><div class="legend">${renderLegend(g)}</div></fieldset>`
  ].join("\n");
}
function renderLegend(g) {
  const rows = [];
  const led = (c, label, hatched = false) => rows.push(`<i class="led" style="--c:var(--${c})${hatched ? `;background:repeating-linear-gradient(45deg, var(--${c}) 0 2px, var(--paper-2) 2px 4px);border-color:var(--${c})` : ""}"></i><span>${label}</span>`);
  const line = (stroke, label, extra = "") => rows.push(`<svg viewBox="0 0 40 12"><path d="M1 6H39" ${stroke} stroke-linecap="round"></path>${extra}</svg><span>${label}</span>`);
  for (const s of ["reproduced", "observed", "unverified", "conflicting"]) if (g.findings.some((b) => b.state === s)) led(s, s);
  if (g.findings.some((b) => b.expired || b.superseded)) led("observed", "past valid_to or superseded", true);
  const types = new Set(g.edges.map((e) => e.type)), transfer = new Set(g.edges.filter((e) => e.type === "transfer").map((e) => String(e.props.state ?? "")));
  const plain = 'stroke="var(--muted)" stroke-width="1.5"';
  if (types.has("about")) line(plain, "about");
  if (types.has("discovered_in")) line(`${plain} stroke-dasharray="2 4"`, "discovered in");
  if (types.has("validated_in")) line(plain, "validated in, labelled with the gate", '<text x="20" y="4" text-anchor="middle" font-size="6" fill="var(--soft)" font-family="ui-monospace, monospace" letter-spacing="1">GATE</text>');
  if (transfer.has("proposed")) line(`${plain} stroke-dasharray="5 4"`, "transfer proposed");
  if (transfer.has("confirmed") || transfer.has("confirmed_provisional")) line('stroke="var(--ink)" stroke-width="1.75"', "transfer confirmed");
  if (transfer.has("refuted")) line(`${plain} stroke-dasharray="5 4" opacity=".5"`, "transfer refuted", '<text x="20" y="10" text-anchor="middle" font-size="11" font-weight="700" fill="var(--conflicting)">\xD7</text>');
  if (types.has("supersedes")) line(`${plain} opacity=".3"`, "supersedes");
  if (types.has("conflicts_with")) line('stroke="var(--conflicting)" stroke-width="1.5" stroke-dasharray="1 4"', "conflicts with");
  for (const t of [...types].filter((t2) => !["about", "discovered_in", "validated_in", "transfer", "supersedes", "conflicts_with"].includes(t2)).sort()) line(plain, t.replace(/_/g, " "));
  return rows.length ? rows.join("\n") : '<div class="none">nothing drawn yet</div>';
}
function items(db, g) {
  const titles = titlesOf(g);
  const relsOf = (id) => g.edges.filter((e) => e.src === id || e.dst === id).map((e) => {
    const dir = e.src === id ? "out" : "in", otherId = dir === "out" ? e.dst : e.src;
    return { dir, type: e.type, other: titles.get(otherId) ?? otherId, otherId, props: Object.keys(e.props).length ? JSON.stringify(e.props) : "" };
  });
  const transferCommands = (relId2) => [`kb transfer ${relId2} confirm`, `kb transfer ${relId2} refute`];
  const out = {};
  const put = (n, evidence, commands) => {
    out[n.id] = { id: n.id, kind: n.kind, title: n.title, domain: n.domain, project: n.project, attrs: n.attrs, evidence, rels: relsOf(n.id), commands };
  };
  for (const l of g.lanes) for (const c of COLUMNS) for (const n of l.columns[c]) put(n, [], [`kb retract ${n.id}`]);
  for (const c of g.concepts) put(c, [], [...c.pending ? [`kb concepts accept ${c.pending}`, `kb concepts reject ${c.pending}`] : [], `kb retract ${c.id}`]);
  for (const b of g.findings) put(b, b.evidence, [...g.edges.filter((e) => e.type === "transfer" && e.src === b.id).flatMap((e) => transferCommands(e.id)), `kb retract ${b.id}`, `kb set ${b.id} valid_to <date>`]);
  for (const e of g.edges) {
    const title = `${e.type}: ${titles.get(e.src) ?? e.src} \u2192 ${titles.get(e.dst) ?? e.dst}`, attrs = Object.fromEntries(Object.entries(e.props).map(([k, v]) => [k, [String(v)]]));
    out[e.id] = { id: e.id, kind: "relation", title, domain: getNote(db, e.src)?.domain ?? null, project: null, attrs, evidence: [], rels: [{ dir: "out", type: "src", other: titles.get(e.src) ?? e.src, otherId: e.src, props: "" }, { dir: "out", type: "dst", other: titles.get(e.dst) ?? e.dst, otherId: e.dst, props: "" }], commands: e.type === "transfer" ? transferCommands(e.id) : [] };
  }
  return out;
}
function generateMap(db, outFile = path16.join(paths.stateDir(), "map.html"), today = /* @__PURE__ */ new Date()) {
  const g = graphData(db, today);
  const parts = {
    META: esc(`Generated ${today.toISOString().slice(0, 10)} \xB7 ${plural(g.lanes.length, "domain")} \xB7 ${plural(g.concepts.length, "concept")} \xB7 ${plural(g.findings.length, "finding")} \xB7 ${plural(g.edges.length, "relation")}`),
    FILTERS: renderFilters(g),
    BOARD: renderBoard(g),
    EDGES: renderEdges(g),
    DATA: JSON.stringify({ items: items(db, g) }).replace(/</g, "\\u003c")
    // `</script>` can never close the data block
  };
  const html = TEMPLATE.replace(/__(META|FILTERS|BOARD|EDGES|DATA)__/g, (_, k) => parts[k]);
  mkdirSync8(path16.dirname(outFile), { recursive: true });
  writeFileSync6(outFile, html);
  return outFile;
}

// src/cli/index.ts
import { spawn } from "node:child_process";
var [cmd, ...args] = process.argv.slice(2);
var has = (f) => args.includes(f);
var value = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : void 0;
};
var home = os4.homedir();
var usage = "usage: kb init [--bank <dir>] [--clone <url>] | kb project init --domain <d> [--id <id>] | kb doctor [--baseline] [--live] | kb cleanup [--apply] | kb setup [--device <name>] [--append-claude-md] | kb export | kb rebuild | kb concepts review|accept <id>|reject <id>|split <name> | kb transfer <id> confirm|refute | kb retract <id> | kb set <id> <attr> <value> | kb compare <concept> | kb import serena|claude-memory|all [--root <dir>] | kb sync [--quiet] | kb map [--open] | kb write <spec.json|->\n";
if (cmd === "doctor") process.exitCode = doctor(home, { baseline: has("--baseline"), live: has("--live") });
else if (cmd === "sync") {
  try {
    const r = sync(paths.bankDir());
    if (!has("--quiet")) process.stdout.write(r === "failed" ? `sync: failed (details in ${paths.logsDir()}/hooks.log)
` : `sync: ${r}
`);
    if (r === "failed") process.exitCode = 1;
  } catch (e) {
    process.stderr.write(`kb sync: ${e.message}
`);
    process.exitCode = 1;
  }
} else if (cmd === "cleanup") {
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
} else if (cmd === "init") {
  const bank = value("--bank"), clone = value("--clone");
  if (has("--bank") && !bank || has("--clone") && !clone) {
    process.stderr.write("--bank and --clone need a value\n");
    process.exitCode = 2;
  } else try {
    initBank({ bank, clone });
  } catch (e) {
    process.stderr.write(`kb init: ${e.message}
`);
    process.exitCode = 1;
  }
} else if (cmd === "project" && args[0] === "init") {
  const domain = value("--domain"), id = value("--id");
  if (!domain || has("--id") && !id) {
    process.stderr.write("usage: kb project init --domain <d> [--id <id>]\n");
    process.exitCode = 2;
  } else process.stdout.write(JSON.stringify(projectInit(process.cwd(), { domain, id }), null, 2) + "\n");
} else if (cmd === "export" || cmd === "rebuild") {
  const db = openDb(), bank = paths.bankDir();
  try {
    if (cmd === "export") process.stdout.write(`exported ${exportAll(db, bank)} notes to ${bank}
`);
    else {
      const r = rebuild(db, bank);
      process.stdout.write(`rebuilt index from ${bank}: ${r.imported} notes imported
`);
    }
  } catch (e) {
    process.stderr.write(`kb ${cmd}: ${e.message}
`);
    process.exitCode = 1;
  } finally {
    db.sql.close();
  }
} else if (cmd === "concepts" && ["review", "accept", "reject", "split"].includes(args[0]) && (args[0] === "review" || args[1])) {
  const db = openDb(), bank = paths.bankDir(), [sub, arg] = args;
  try {
    if (sub === "review") {
      const q = pendingQuestions(db, Number.MAX_SAFE_INTEGER);
      process.stdout.write(q.length ? q.join("\n") + "\n" : "no pending concept merges\n");
    } else if (sub === "accept") {
      acceptMerge(db, bank, arg);
      process.stdout.write(`accepted ${arg}
`);
    } else if (sub === "reject") {
      rejectMerge(db, arg);
      process.stdout.write(`rejected ${arg}
`);
    } else process.stdout.write(`split "${arg}" into ${splitAlias(db, bank, arg)}
`);
  } catch (e) {
    process.stderr.write(`kb concepts ${sub}: ${e.message}
`);
    process.exitCode = 1;
  } finally {
    db.sql.close();
  }
} else if (cmd === "transfer" && args[0] && ["confirm", "refute"].includes(args[1]) || cmd === "retract" && args[0] || cmd === "set" && args.length >= 3) {
  const db = openDb(), bank = paths.bankDir(), [id, a, b] = args;
  try {
    if (cmd === "transfer") {
      const state = a === "confirm" ? "confirmed" : "refuted";
      const next = setTransfer(db, bank, id, state);
      process.stdout.write(`transfer ${id} ${state}; its id is now ${next}
`);
    } else if (cmd === "retract") {
      retractNote(db, bank, id);
      process.stdout.write(`retracted ${id}
`);
    } else {
      setAttr(db, bank, id, a, b);
      process.stdout.write(`set ${a}=${b} on ${id}
`);
    }
  } catch (e) {
    process.stderr.write(`kb ${cmd}: ${e.message}
`);
    process.exitCode = 1;
  } finally {
    db.sql.close();
  }
} else if (cmd === "import" && ["serena", "claude-memory", "all"].includes(args[0])) {
  const root = value("--root");
  if (has("--root") && !root) {
    process.stderr.write("--root needs a directory\n");
    process.exitCode = 2;
  } else {
    const db = openDb(), bank = paths.bankDir(), roots = [root ?? path17.join(home, "projects")];
    const line = (what, r) => process.stdout.write(`${what}: ${r.files} files, ${r.created} created, ${r.unchanged} unchanged
`);
    try {
      if (args[0] !== "claude-memory") line("serena", importSerena(db, bank, roots));
      if (args[0] !== "serena") line("claude-memory", importClaudeMemory(db, bank));
    } catch (e) {
      process.stderr.write(`kb import: ${e.message}
`);
      process.exitCode = 1;
    } finally {
      db.sql.close();
    }
  }
} else if (cmd === "write" && args[0]) {
  const db = openDb(), bank = paths.bankDir();
  try {
    const spec = JSON.parse(readFileSync14(args[0] === "-" ? 0 : args[0], "utf8"));
    const defaults = spec.defaults ?? {}, records = spec.records ?? spec;
    const ids2 = /* @__PURE__ */ new Map(), now = (/* @__PURE__ */ new Date()).toISOString();
    let written = 0, failed = 0, already = 0;
    const draftFile = args[0] !== "-" && path17.basename(args[0]) === "draft-findings.json";
    for (const rec of records) {
      const { key, written: done, ...r } = rec;
      if (done) {
        already++;
        continue;
      }
      try {
        const rels = (r.rels ?? []).map((l) => ({ ...l, dst: l.dst.startsWith("@") ? ids2.get(l.dst.slice(1)) ?? (() => {
          throw new Error(`unknown key ${l.dst}`);
        })() : l.dst }));
        const res = kbWrite(db, bank, { domain: defaults.domain, project: defaults.project, ...r, rels }, now);
        if (key) ids2.set(key, res.id);
        if (draftFile) rec.written = res.id;
        written++;
        process.stdout.write(`${res.created ? "created" : "updated"}  ${res.id}  ${r.kind}  ${r.title}${res.transfers.length ? `  (${res.transfers.length} transfer${res.transfers.length === 1 ? "" : "s"} proposed)` : ""}
`);
      } catch (e) {
        failed++;
        process.stdout.write(`error    ${r.kind}  ${r.title}: ${e.message}
`);
      }
    }
    if (draftFile && written) writeFileAtomic(args[0], JSON.stringify({ ...spec, records }, null, 2) + "\n");
    process.stdout.write(`${written} written, ${failed} failed${already ? `, ${already} already recorded` : ""}
`);
    if (failed) process.exitCode = 1;
  } catch (e) {
    process.stderr.write(`kb write: ${e.message}
`);
    process.exitCode = 1;
  } finally {
    db.sql.close();
  }
} else if (cmd === "map") {
  const db = openDb();
  try {
    const file = generateMap(db);
    process.stdout.write(`${file}
`);
    if (has("--open")) {
      const [bin, pre] = process.platform === "darwin" ? ["open", []] : process.platform === "win32" ? ["cmd", ["/c", "start", ""]] : ["xdg-open", []];
      spawn(bin, [...pre, file], { detached: true, stdio: "ignore" }).unref();
    }
  } catch (e) {
    process.stderr.write(`kb map: ${e.message}
`);
    process.exitCode = 1;
  } finally {
    db.sql.close();
  }
} else if (cmd === "compare" && args[0]) {
  const db = openDb(), name = args.join(" ");
  try {
    const rows = compareConcept(db, resolveConceptRef(db, name));
    process.stdout.write(rows.length ? rows.map((r) => compareLine(r)).join("\n") + "\n" : `no findings about ${name}
`);
  } catch (e) {
    process.stderr.write(`kb compare: ${e.message}
`);
    process.exitCode = 1;
  } finally {
    db.sql.close();
  }
} else {
  process.stdout.write(usage);
  if (cmd && cmd !== "help" && cmd !== "--help") process.exitCode = 2;
}
