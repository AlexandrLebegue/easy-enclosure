import express from 'express';
import type { Request, Response } from 'express';
import { loadParts, resolvePartTypes } from '../../../../scripts/db/lib.js';
import type { ComponentSpec } from '../model/component.types';

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_PORT = 4100;

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: Request, res: Response, next: () => void) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  app.get('/api/parts', (_req: Request, res: Response) => {
    const parts: ComponentSpec[] = Array.from(loadParts().values());
    res.json({ count: parts.length, parts });
  });

  app.get('/api/parts/:partType', (req: Request, res: Response) => {
    const partType = req.params['partType'];
    const spec = loadParts().get(partType);
    if (!spec) {
      res.status(404).json({ error: 'NOT_FOUND', partType });
      return;
    }
    res.json(spec);
  });

  app.post('/api/parts/resolve', (req: Request, res: Response) => {
    const partTypes = req.body?.partTypes;
    if (!Array.isArray(partTypes) || partTypes.some((item) => typeof item !== 'string')) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'body.partTypes must be a string[]' });
      return;
    }
    res.json(resolvePartTypes(partTypes));
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'NOT_FOUND' });
  });

  return app;
}

export function startServer(port?: number) {
  const listenPort = port ?? Number(process.env['DB_PORT'] || DEFAULT_PORT);
  const app = createApp();
  return app.listen(listenPort, () => {
    console.log(`Velxio component DB listening on http://localhost:${listenPort}`);
  });
}
