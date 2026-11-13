import { cpSync, existsSync, statSync, createReadStream } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { defaultClientConditions, defineConfig, type Plugin } from 'vite';

const ASSETS_DIR = resolve(import.meta.dirname, '../../assets');
const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
};
/** Raw generator output and editor junk stay out of the game. */
const skip = (path: string) => /(^|[\\/])(_source|\.DS_Store)([\\/]|$)/.test(path);

/**
 * Serves the repo-level `assets/` folder at /assets/ in dev and copies it into dist/assets on
 * build. A missing file is a real 404 (not the index.html fallback), so the loader can tell.
 */
function assetsPlugin(): Plugin {
  return {
    name: 'monkey-assets',
    configureServer(server) {
      server.middlewares.use('/assets', (req, res) => {
        const rel = normalize(decodeURIComponent((req.url ?? '').split('?')[0] ?? ''));
        const file = join(ASSETS_DIR, rel);
        if (
          !file.startsWith(ASSETS_DIR + sep) ||
          skip(rel) ||
          !existsSync(file) ||
          !statSync(file).isFile()
        ) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      if (!existsSync(ASSETS_DIR)) return;
      cpSync(ASSETS_DIR, resolve(import.meta.dirname, 'dist/assets'), {
        recursive: true,
        filter: (src) => !skip(src),
      });
    },
  };
}

export default defineConfig({
  plugins: [assetsPlugin()],
  // Use @monkey-mania-2/shared from source, so no shared build is needed for dev.
  resolve: { conditions: ['source', ...defaultClientConditions] },
  server: { proxy: { '/ws': { target: 'ws://localhost:3000', ws: true } } },
});
