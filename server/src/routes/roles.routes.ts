import { Router } from 'express';
import { db } from '../db/client.js';
import { requireAuth, requirePerm } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  user_count: number;
}

interface PermRow {
  key: string;
  description: string | null;
}

router.get('/', requirePerm('system.admin'), (_req, res) => {
  const roles = db()
    .prepare(
      `SELECT r.id, r.name, r.description,
              (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
         FROM roles r
         ORDER BY r.name`,
    )
    .all() as RoleRow[];

  const allPerms = db()
    .prepare('SELECT key, description FROM permissions ORDER BY key')
    .all() as PermRow[];

  const matrixRows = db()
    .prepare(
      `SELECT rp.role_id, p.key AS perm_key
         FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id`,
    )
    .all() as { role_id: string; perm_key: string }[];

  const permsByRole: Record<string, string[]> = {};
  for (const r of roles) permsByRole[r.id] = [];
  for (const m of matrixRows) permsByRole[m.role_id].push(m.perm_key);

  res.json({
    roles: roles.map((r) => ({ ...r, permissions: permsByRole[r.id] })),
    permissions: allPerms,
  });
});

export default router;
