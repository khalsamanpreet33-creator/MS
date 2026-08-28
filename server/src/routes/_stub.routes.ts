import { Router } from 'express';

/** Catch-all stub router factory for Phase 2/3/4 modules. */
export function stubRouter(moduleName: string): Router {
  const r = Router();
  r.get('/', (_req, res) => {
    res.json({
      module: moduleName,
      status: 'not_implemented',
      message: 'This module ships in Phase 2. The route is wired so the SPA can navigate to it.',
    });
  });
  r.get('/*', (_req, res) => {
    res.json({ module: moduleName, status: 'not_implemented' });
  });
  return r;
}