export function readStdin(idleMs = 1500): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []; let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); let s = Buffer.concat(chunks).toString('utf8'); if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); resolve(s); };
    const timer = setTimeout(() => { if (chunks.length === 0) finish(); }, idleMs);
    process.stdin.on('data', (c: Buffer) => chunks.push(c)); process.stdin.on('end', finish); process.stdin.on('error', finish); process.stdin.resume();
  });
}
