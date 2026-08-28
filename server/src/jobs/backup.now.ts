/* CLI entry: `tsx src/jobs/backup.now.ts` */
import { runBackup } from './backup.job.js';
import { ensureDirs } from '../config.js';

ensureDirs();

runBackup()
  .then((r) => {
    console.log('[backup] complete:', r);
    process.exit(0);
  })
  .catch((e) => {
    console.error('[backup] failed:', e);
    process.exit(1);
  });