import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { Template } from './templates.js';
/** The only module that imports `yaml`; never reachable from dist/hook.js (esbuild guard). */
export function loadTemplate(file: string): Template { return parse(readFileSync(file, 'utf8')) as Template; }
