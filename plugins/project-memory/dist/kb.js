#!/usr/bin/env node
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);

// src/cli/index.ts
process.stdout.write("usage: kb <command>\n");
