// Minimal wrapper: read all of stdin, parse JSON, run the handler, print its result, always exit 0. Task 2 replaces it.
export async function runHook(event: string, fn: (input: Record<string, unknown>) => Promise<unknown>): Promise<void> {
  try {
    let raw = '';
    for await (const chunk of process.stdin) raw += chunk;
    const input = raw.trim() ? JSON.parse(raw) : {};
    const out = await fn(input);
    if (out !== undefined) process.stdout.write(JSON.stringify(out));
  } catch (e) {
    process.stderr.write(`project-memory ${event}: ${String(e)}\n`);
  }
  process.exit(0);
}
