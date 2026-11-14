import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const main = fileURLToPath(new URL('../packages/server/dist/main.js', import.meta.url));

export interface TestServer {
  url: string;
  /** Everything the server wrote to stderr, plus JSON log lines that report a fault. */
  problems: string[];
  stop(): Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });
}

/** Starts the built server (npm run build first) with the short-match flag on. */
export async function startServer(): Promise<TestServer> {
  const port = await freePort();
  const problems: string[] = [];
  const child: ChildProcess = spawn(process.execPath, [main], {
    env: { ...process.env, PORT: String(port), E2E_FAST: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr?.on('data', (d: Buffer) => problems.push(`stderr: ${d.toString().trim()}`));
  let ready: () => void;
  const listening = new Promise<void>((r) => (ready = r));
  child.stdout?.on('data', (d: Buffer) => {
    for (const line of d.toString().split('\n')) {
      if (line.includes('listening')) ready();
      if (/"event":"(connectionError|matchError)"/.test(line)) problems.push(line);
    }
  });
  child.once('exit', (code) => code && problems.push(`server exited with ${code}`));
  await listening;
  return {
    url: `http://localhost:${port}`,
    problems,
    stop: () =>
      new Promise((resolve) => {
        child.once('exit', () => resolve());
        child.kill('SIGKILL');
      }),
  };
}
