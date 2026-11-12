import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const here = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(here, '../../client/dist');
const port = Number(process.env.PORT ?? 3000);

createApp(clientDir).listen(port, () => {
  console.log(`Monkey Mania II server listening on http://localhost:${port}`);
});
